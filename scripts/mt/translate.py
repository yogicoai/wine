# 로컬 기계번역 — NLLB-200 (CTranslate2 int8, CPU). 모델 호출 토큰이 들지 않는다.
#
#   data/mt/venv/Scripts/python.exe scripts/mt/translate.py --lang en --in data/mt/units.jsonl --out data/mt/out-en.jsonl
#
# 입력 JSONL 한 줄: {"id": "...", "text": "한국어 문장"}   출력 JSONL 한 줄: {"id": "...", "out": "번역"}
# 이미 출력에 있는 id 는 건너뛴다 (끊겼다 다시 해도 이어서 한다).
import argparse, json, os, sys, time

LANG = {"en": "eng_Latn", "ja": "jpn_Jpan", "ko": "kor_Hang"}

ap = argparse.ArgumentParser()
ap.add_argument("--lang", required=True, choices=["en", "ja"], help="번역 대상 언어 (to-ko 일 때는 입력의 언어)")
ap.add_argument("--in", dest="inp", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--model-dir", default=r"C:\Users\Yogibo Design\mt-work\models\nllb-1.3b")
ap.add_argument("--beam", type=int, default=4)
ap.add_argument("--batch", type=int, default=24)
ap.add_argument("--chunk", type=int, default=600, help="한 번에 번역기에 넘기는 문장 수 (길이순으로 묶어 속도를 낸다)")
ap.add_argument("--limit", type=int, default=0)
ap.add_argument("--threads", type=int, default=12, help="문장 하나를 계산하는 스레드 수(intra)")
ap.add_argument("--inter", type=int, default=1, help="동시에 계산하는 묶음 수 — 여러 묶음을 병렬로 돌리면 처리량이 오른다")
ap.add_argument("--src", default=None, help="원문 언어 코드(기본: 번역 방향에 따라 kor_Hang)")
ap.add_argument("--direction", choices=["from-ko", "to-ko"], default="from-ko", help="to-ko: 영어·일본어 → 한국어 역번역(검증용)")
a = ap.parse_args()

# 이 번역 프로세스만 우선순위를 한 단계 올린다 — 다른 프로그램(개발 서버 등)이 CPU 를 잡고 있어도 계산이 굶지 않게
try:
    import ctypes
    k32 = ctypes.windll.kernel32
    k32.GetCurrentProcess.restype = ctypes.c_void_p                      # 64비트에서 핸들이 잘리지 않게 형을 밝힌다
    k32.SetPriorityClass.argtypes = [ctypes.c_void_p, ctypes.c_uint]
    k32.SetPriorityClass(k32.GetCurrentProcess(), 0x00008000)            # ABOVE_NORMAL
except Exception:
    pass

import ctranslate2, transformers

SRC = LANG["ko"] if a.direction == "from-ko" else LANG[a.lang]
TGT = LANG[a.lang] if a.direction == "from-ko" else LANG["ko"]
tok = transformers.AutoTokenizer.from_pretrained(a.model_dir, src_lang=SRC)
tr = ctranslate2.Translator(a.model_dir, device="cpu", compute_type="int8", inter_threads=a.inter, intra_threads=a.threads)
tgt = TGT

done = set()
if os.path.exists(a.out):
    with open(a.out, encoding="utf-8") as f:
        for ln in f:
            try: done.add(json.loads(ln)["id"])
            except Exception: pass

items = []
with open(a.inp, encoding="utf-8") as f:
    for ln in f:
        o = json.loads(ln)
        if o["id"] not in done and o["text"].strip():
            items.append(o)
if a.limit: items = items[: a.limit]
print(f"번역할 문장 {len(items)} (이미 끝낸 {len(done)}) → {a.lang}", flush=True)

t0 = time.time(); n = 0
with open(a.out, "a", encoding="utf-8") as fo:
    for i in range(0, len(items), a.chunk):
        chunk = items[i : i + a.chunk]
        src = [tok.convert_ids_to_tokens(tok.encode(o["text"])) for o in chunk]
        # 입력의 3배 + 여유까지만 생성 (무한 반복 방지)
        mx = [min(512, int(len(s) * 3) + 16) for s in src]
        res = tr.translate_batch(src, target_prefix=[[tgt]] * len(src), beam_size=a.beam, max_batch_size=a.batch,
                                 batch_type="examples", max_decoding_length=max(mx), repetition_penalty=1.1, no_repeat_ngram_size=0)
        for o, r in zip(chunk, res):
            hyp = r.hypotheses[0][1:]  # 첫 토큰은 언어 코드
            out = tok.decode(tok.convert_tokens_to_ids(hyp), skip_special_tokens=True).strip()
            fo.write(json.dumps({"id": o["id"], "out": out}, ensure_ascii=False) + "\n")
        fo.flush()
        n += len(chunk)
        el = time.time() - t0
        print(f"  {n}/{len(items)} · {el:.0f}초 · 문장당 {el / n:.2f}초 · 남은 약 {(len(items) - n) * el / n / 60:.1f}분", flush=True)
print("끝", flush=True)
