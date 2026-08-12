import Link from "next/link";
import { catalogStats } from "@/lib/catalog";
import s from "../guide/guide.module.css";
import p from "./plan.module.css";

// 내부 검토용 페이지. 출시 전에 폴더째 지우면 된다 (app/plan/).
// 클라이언트와 나눌 자료라 링크로 열리게 두되, 검색에는 걸리지 않게 한다.
export const metadata = {
  title: "보틀 렌즈 — 진행 계획 · 사업성 · 판매 전략 (내부)",
  robots: { index: false, follow: false },
};

// 보유 종수는 매일 늘어나므로 실제 DB 값을 쓴다
export const revalidate = 3600;

const COST_ROWS = [
  ["0%", "66원", "출시 첫날. DB에 아무것도 없을 때"],
  ["30%", "47원", "인기 술이 조금씩 반복되기 시작"],
  ["50%", "35원", "수백 종이 쌓인 시점"],
  ["70%", "22원", "국내 유통 주력 제품을 대부분 보유"],
  ["85%", "13원", "바코드 대조표가 자리잡은 뒤"],
  ["95%", "6원", "성숙기"],
];

export default async function PlanPage() {
  const catalog = await catalogStats().catch(() => null);
  const owned = catalog?.total ? catalog.total.toLocaleString("ko-KR") : "4,000+";
  const deep = catalog?.full ? catalog.full.toLocaleString("ko-KR") : "100+";

  return (
    <div className={s.wrap}>
      <div className={s.topbar}>
        <Link href="/" className={s.brand}>
          Bottle <em>Lens</em>
        </Link>
        <Link href="/guide" className={s.back}>
          기능 설명서
        </Link>
      </div>

      <header className={s.hero}>
        <p className={s.eyebrow}>내부 검토 자료</p>
        <h1 className={s.title}>
          진행 계획 · 사업성 · 판매 전략
          <span className={s.titleKo}>보유 데이터 {owned}종 기준</span>
        </h1>
        <p className={s.lede}>
          지금까지 만든 것과 앞으로 해야 할 것, 그리고 이 서비스가 돈이 되는 구조인지를 정리했습니다.
          <b> 추정이 들어간 곳은 근거를 함께 적었습니다.</b>
        </p>
        <div className={p.notice}>
          이 페이지는 내부 검토용입니다. 출시 시점에 <code>app/plan/</code> 폴더를 지우면 함께 사라집니다.
        </div>
      </header>

      {/* 00 빠른 사용법 — 자세한 것은 /guide, 여기서는 한눈에 */}
      <section className={s.section}>
        <div className={s.num}>00</div>
        <div className={s.body}>
          <h2 className={s.h2}>빠른 사용법</h2>
          <p className={s.sub}>
            5가지 핵심 흐름입니다. 자세한 설명은{" "}
            <Link href="/guide" style={{ color: "var(--gold)" }}>기능 설명서(/guide)</Link>에 있습니다.
          </p>
          <div className={s.scroll}>
            <table className={s.table}>
              <thead><tr><th>하고 싶은 것</th><th>어떻게</th><th>비용</th></tr></thead>
              <tbody>
                <tr>
                  <td>이 술이 뭔지 알고 싶다</td>
                  <td className={s.was}>첫 화면 → <b>라벨 촬영</b> → 셔터</td>
                  <td className={s.numCell}>DB에 있으면 0원</td>
                </tr>
                <tr>
                  <td>더 빠르게 확인</td>
                  <td className={s.was}><b>바코드</b> 탭 → 병 뒷면을 비추면 자동 인식</td>
                  <td className={s.numCell}><b>항상 0원</b></td>
                </tr>
                <tr>
                  <td>식당에서 뭘 시킬지</td>
                  <td className={s.was}><b>와인 리스트</b> 탭 → 메뉴판 한 장 촬영 → 가성비 순</td>
                  <td className={s.numCell}>약 5원/장</td>
                </tr>
                <tr>
                  <td>사진 없이 찾기 · 추천받기</td>
                  <td className={s.was}>헤더 🔍 → 이름·산지 검색 / O·X 취향 문답 8개</td>
                  <td className={s.numCell}>0원</td>
                </tr>
                <tr>
                  <td>내 와인 관리 · 특가 알림</td>
                  <td className={s.was}>결과 화면에서 셀러에 담기 → 헤더 🍷 → 목표가 설정</td>
                  <td className={s.numCell}>0원</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 01 현황 */}
      <section className={s.section}>
        <div className={s.num}>01</div>
        <div className={s.body}>
          <h2 className={s.h2}>지금 어디까지 왔나</h2>
          <p className={s.sub}>기능은 대부분 갖춰졌고, 데이터가 비어 있습니다.</p>

          <div className={s.scroll}>
            <table className={s.table}>
              <thead><tr><th>영역</th><th>상태</th></tr></thead>
              <tbody>
                <tr><td>라벨 인식 · 분석</td><td className={s.now}>완료</td></tr>
                <tr><td>바코드 인식</td><td className={s.now}>완료 · 실기기 확인</td></tr>
                <tr><td>와인 리스트 스캔</td><td className={s.was}>완료 · 실제 메뉴판 미검증</td></tr>
                <tr><td>구매 연결 · 가격</td><td className={s.now}>완료</td></tr>
                <tr><td>셀러 · 노트 · 취향</td><td className={s.now}>완료</td></tr>
                <tr><td>맞춤 추천 · 검색</td><td className={s.now}>완료</td></tr>
                <tr><td>가격 이력 · 특가 알림</td><td className={s.was}>완료 · 데이터 축적 중</td></tr>
                <tr><td>집단 평점</td><td className={s.was}>구조만 · 표 0개</td></tr>
                <tr><td><b>카탈로그 데이터</b></td><td className={s.now}><b>{owned}종 — 매일 자동 확장 중</b></td></tr>
                <tr><td>└ 정식 분석</td><td className={s.was}>{deep}종 (스토리·페어링까지). 나머지는 이름·산지·품종·가격대</td></tr>
                <tr><td><b>로그인 · 19세 인증</b></td><td className={s.was}><b>미착수 — 출시 선행 조건</b></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 02 남은 작업 */}
      <section className={s.section}>
        <div className={s.num}>02</div>
        <div className={s.body}>
          <h2 className={s.h2}>출시까지 해야 할 일</h2>
          <p className={s.sub}>광고를 뺀 순서입니다. 위에서부터 순서대로 해야 뒤가 막히지 않습니다.</p>

          <div className={s.prio}>
            <div className={s.item}>
              <h3 className={s.h4}>1. 로그인 · 만 19세 인증 · 사용량 제한</h3>
              <span className={`${s.flag} ${s.must}`}>선행 조건</span>
              <p className={s.p}>
                지금은 모든 기록이 기기 단위로 공용입니다. 사용자 구분이 없어 사용량도 못 막습니다.
                주류 서비스는 성인 확인이 법적으로 필요하고 스토어 심사에서도 봅니다.
                <b> 이것이 안 되면 스토어에 올릴 수 없습니다.</b>
              </p>
              <p className={s.p}>
                화면 레이아웃은 <b>[내 정보] 서랍에 이미 잡아 두었습니다.</b> 인증만 붙이면 살아납니다.
                기존 기기 기록을 계정으로 옮기는 절차도 함께 정해야 합니다 — 지금 안 정하면 나중에 버리게 됩니다.
              </p>
            </div>

            <div className={s.item}>
              <h3 className={s.h4}>2. 카탈로그 확장 — 진행 중</h3>
              <span className={`${s.flag} ${s.must}`}>비용 구조의 핵심</span>
              <p className={s.p}>
                <b>{owned}종을 보유했습니다</b> (목표 3,000종 초과 달성). 국내 대형 와인샵 한 곳의
                취급 규모를 넘습니다. 매일 새벽 수확 크론이 새로 팔리기 시작한 술을 자동으로
                추가하고, 사용자가 찾았는데 없던 이름은 기록되어 다음에 채울 목록이 됩니다.
                표기가 달라도 잇는 느슨한 매칭까지 갖춰 <b>DB가 커지는 만큼 적중률이 실제로 오릅니다.</b>
              </p>
            </div>

            <div className={s.item}>
              <h3 className={s.h4}>3. 개인정보처리방침 · 약관</h3>
              <span className={`${s.flag} ${s.must}`}>선행 조건</span>
              <p className={s.p}>
                카메라 · 알림 · 계정을 쓰므로 반드시 필요하고, 없으면 스토어 등록 자체가 되지 않습니다.
                네이버 오픈 API 이용약관의 출처 표기 조건도 이때 함께 확인해야 합니다.
              </p>
            </div>

            <div className={s.item}>
              <h3 className={s.h4}>4. 미검증 기능 실기기 확인</h3>
              <span className={`${s.flag} ${s.soon}`}>시연 전</span>
              <p className={s.p}>
                와인 리스트 스캔(실제 메뉴판), 공유 카드(iOS 공유 시트), 음용 적기 알림(크론 실행),
                셀러 가치(시세 갱신). 만들어 두고 돌려보지 않은 것을 됐다고 하면 시연에서 터집니다.
              </p>
            </div>

            <div className={s.item}>
              <h3 className={s.h4}>5. 스토어 등록물</h3>
              <span className={`${s.flag} ${s.soon}`}>출시 직전</span>
              <p className={s.p}>
                512×512 maskable 아이콘(여백 포함), 피처 그래픽 1024×500, 스크린샷 4~8장,
                콘텐츠 등급 19+, 음주 경고 문구. Play 개인 계정은 프로덕션 전 비공개 테스트 기간이
                요구되므로 <b>일정을 잡을 때 먼저 확인해야 합니다.</b>
              </p>
            </div>

            <div className={s.item}>
              <h3 className={s.h4}>6. 수익 연결</h3>
              <span className={`${s.flag} ${s.soon}`}>출시 후</span>
              <p className={s.p}>
                제휴 수수료 → 구독 → B2B 순서를 권합니다. 근거는 4장에 있습니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 03 원가 */}
      <section className={s.section}>
        <div className={s.num}>03</div>
        <div className={s.body}>
          <h2 className={s.h2}>원가 구조 — 실측 기반</h2>
          <p className={s.sub}>추정이 아니라 실제로 측정한 값입니다.</p>

          <div className={s.scroll}>
            <table className={s.table}>
              <thead><tr><th>경로</th><th className={s.numCell}>원가</th><th>비고</th></tr></thead>
              <tbody>
                <tr><td>웹 검색 켠 분석</td><td className={`${s.numCell} ${s.priceHi}`}>474원</td><td>179초. 기본 꺼 둠</td></tr>
                <tr><td>일반 분석 (웹 검색 끔)</td><td className={s.numCell}>66원</td><td>약 30초</td></tr>
                <tr><td>DB 적중 (사진)</td><td className={s.numCell}>약 3원</td><td>저비용 모델로 이름만 판독</td></tr>
                <tr><td>DB 적중 (이름 · 검색)</td><td className={s.numCell}><b>0원</b></td><td>AI 호출 없음</td></tr>
                <tr><td>바코드</td><td className={s.numCell}><b>0원</b></td><td>AI 호출 없음</td></tr>
                <tr><td>와인 리스트 한 장</td><td className={s.numCell}>약 5원</td><td>항목 수와 무관하게 1회 호출</td></tr>
                <tr><td>시세 표시</td><td className={s.numCell}><b>0원</b></td><td>우리 데이터 (외부 호출 없음)</td></tr>
                <tr><td>판매가 · 상품 사진</td><td className={s.numCell}><b>0원</b></td><td>11번가 오픈 API 무료</td></tr>
              </tbody>
            </table>
          </div>

          <h3 className={s.h4} style={{ marginTop: "2rem" }}>DB 적중률이 원가를 결정합니다</h3>
          <p className={s.p}>
            같은 술을 다른 사람이 또 찍으면 AI를 부르지 않습니다. 그래서 <b>스캔이 쌓일수록 원가가 내려갑니다.</b>
            이것이 이 서비스의 구조적 강점입니다.
          </p>
          <div className={s.scroll}>
            <table className={s.table}>
              <thead><tr><th>DB 적중률</th><th className={s.numCell}>스캔당 평균 원가</th><th>시점</th></tr></thead>
              <tbody>
                {COST_ROWS.map(([hit, cost, when]) => (
                  <tr key={hit}>
                    <td>{hit}</td>
                    <td className={s.numCell}><b>{cost}</b></td>
                    <td className={s.was}>{when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={s.p}>
            <b>가정.</b> 적중 시 3원(사진 경로), 미적중 시 66원으로 계산했습니다. 바코드와 이름 검색이
            늘수록 실제 평균은 이보다 낮아집니다.
          </p>

          <div className={p.callout}>
            <b>그래서 카탈로그 확장이 기능 추가보다 우선입니다.</b> 데이터를 미리 채우는 일은
            대화로 하면 AI 비용이 들지 않는데, 그 결과로 운영 원가가 최대 90%까지 내려갑니다.
            같은 노력 대비 효과가 가장 큰 작업입니다.
          </div>

          <h3 className={s.h4} style={{ marginTop: "2rem" }}>고정비</h3>
          <ul className={s.list}>
            <li><b>네이버 검색 API</b> — 무료 (일 25,000회). 하루 스캔 수천 건까지 여유</li>
            <li><b>MongoDB Atlas</b> — 무료 티어 512MB. 이미지를 DB에 넣지 않으므로 한동안 충분</li>
            <li><b>Vercel</b> — 초기 무료. 트래픽이 늘면 유료 전환 필요</li>
            <li><b>Cafe24 이미지 호스팅</b> — 기존 보유</li>
          </ul>
          <p className={s.p}>
            <b>초기 고정비가 사실상 0에 가깝습니다.</b> 변동비(AI 호출)만 관리하면 되는 구조입니다.
          </p>
        </div>
      </section>

      {/* 04 수익 */}
      <section className={s.section}>
        <div className={s.num}>04</div>
        <div className={s.body}>
          <h2 className={s.h2}>수익 구조</h2>
          <p className={s.sub}>가능한 것과, 국내 규제 때문에 어려운 것을 나눴습니다.</p>

          <div className={p.callout}>
            <b>먼저 알아야 할 제약.</b> 국내법상 <b>일반 주류는 온라인 배송이 되지 않습니다.</b>
            매장 픽업(스마트오더) 방식만 가능하고, 전통주만 직배송이 됩니다. 그래서 &ldquo;와인을 팔아
            수수료를 받는&rdquo; 단순한 그림은 그대로 성립하지 않습니다. 수익 설계는 이 제약 위에서 해야 합니다.
          </div>

          <div className={s.prio}>
            <div className={s.item}>
              <h3 className={s.h4}>A. 안주 · 식품 제휴</h3>
              <span className={`${s.flag} ${s.soon}`}>가장 현실적</span>
              <p className={s.p}>
                <b>식품은 온라인 배송에 제약이 없습니다.</b> 우리는 이미 페어링 음식마다 상품을
                연결하고 있어서, 링크에 제휴 파라미터만 붙이면 됩니다. 화면을 바꿀 필요가 없습니다.
              </p>
              <p className={s.p}>
                객단가는 낮지만 전환 맥락이 좋습니다. &ldquo;이 와인에 이 안주&rdquo;는 그 자리에서 사고 싶어지는 제안입니다.
              </p>
            </div>

            <div className={s.item}>
              <h3 className={s.h4}>B. 주류 커머스 · 스마트오더 제휴</h3>
              <span className={`${s.flag} ${s.soon}`}>제휴 필요</span>
              <p className={s.p}>
                픽업 예약 플랫폼과 연결하면 주류 자체에서 수수료가 생깁니다. 객단가가 안주보다 훨씬 큽니다.
                다만 <b>우리가 만들 수 있는 것이 아니라 협상해야 하는 영역</b>입니다.
              </p>
            </div>

            <div className={s.item}>
              <h3 className={s.h4}>C. 구독</h3>
              <span className={`${s.flag} ${s.soon}`}>사용량 제한과 한 묶음</span>
              <p className={s.p}>
                무료 월 N회 / 프리미엄 무제한. <b>사용량 제한이 없으면 구독할 이유도 없습니다.</b>
                그래서 1번 작업(로그인·사용량 제한)과 같이 가야 합니다.
              </p>
              <p className={s.p}>
                원가가 스캔당 수 원~수십 원이므로, 월 몇천 원 구독이면 헤비 유저도 감당됩니다.
                <b> DB가 쌓일수록 구독 마진이 좋아지는 구조</b>입니다.
              </p>
            </div>

            <div className={s.item}>
              <h3 className={s.h4}>D. B2B</h3>
              <span className={`${s.flag} ${s.idea}`}>중장기</span>
              <p className={s.p}>
                보틀샵 · 마트용 스캔 위젯, 주류 이커머스 대상 분석 API. 우리가 쌓은 카탈로그 자체가
                상품이 됩니다. <b>B2C보다 단가가 크고 마케팅 비용이 들지 않습니다.</b>
              </p>
            </div>
          </div>

          <h3 className={s.h4} style={{ marginTop: "2rem" }}>손익이 맞으려면</h3>
          <p className={s.p}>
            사용자 한 명이 월 10회 스캔한다고 가정하면
          </p>
          <div className={s.scroll}>
            <table className={s.table}>
              <thead><tr><th>DB 적중률</th><th className={s.numCell}>1인당 월 원가</th><th>필요한 월 수익</th></tr></thead>
              <tbody>
                <tr><td>30% (초기)</td><td className={s.numCell}>470원</td><td className={s.was}>제휴만으로는 빠듯</td></tr>
                <tr><td>70%</td><td className={s.numCell}>220원</td><td className={s.was}>제휴로 감당 가능</td></tr>
                <tr><td>90%</td><td className={s.numCell}><b>90원</b></td><td className={s.now}>여유. 구독은 순마진</td></tr>
              </tbody>
            </table>
          </div>
          <p className={s.p}>
            <b>결론.</b> 초기에는 원가가 부담이지만 <b>DB를 채우는 것만으로 손익이 뒤집힙니다.</b>
            사용자를 늘리는 것보다 데이터를 채우는 것이 먼저입니다.
          </p>
        </div>
      </section>

      {/* 05 강점과 위험 */}
      <section className={s.section}>
        <div className={s.num}>05</div>
        <div className={s.body}>
          <h2 className={s.h2}>강점과 위험</h2>

          <h3 className={s.h4}>강점</h3>
          <ul className={s.list}>
            <li><b>쓸수록 싸진다</b> — 카탈로그 · 바코드 대조표 · 집단 평점이 모두 사용과 함께 쌓입니다. 경쟁자가 뒤늦게 따라오기 어려운 구조입니다</li>
            <li><b>초기 고정비가 거의 없다</b> — 실패해도 손실이 작고, 되면 바로 확장됩니다</li>
            <li><b>국내 특화</b> — 네이버 가격 연동, 한국 표기 대응, 안주 페어링. 글로벌 앱이 잘 못하는 영역입니다</li>
            <li><b>식당에서 쓰인다</b> — 와인 리스트 스캔은 &ldquo;집에서 찾아보는 앱&rdquo;을 &ldquo;주문 직전에 꺼내는 앱&rdquo;으로 바꿉니다</li>
            <li><b>첫날부터 추천</b> — Vivino는 여러 병을 마시고 평가해야 추천이 나옵니다. 우리는 문답 여덟 개면 됩니다</li>
          </ul>

          <h3 className={s.h4} style={{ marginTop: "1.8rem" }}>위험</h3>
          <ul className={s.list}>
            <li><b>주류 온라인 판매 제한</b> — 구매 전환 수익의 상한이 정해져 있습니다. 안주 · 픽업 · 구독으로 우회해야 합니다</li>
            <li><b>Vivino의 평점 규모</b> — 수천만 표는 시간으로만 따라잡을 수 있습니다. 정면 승부가 아니라 국내 특화 · 셀러 관리 · 식당 사용성으로 갈라서야 합니다</li>
            <li><b>AI 단가 변동</b> — 모델 가격 정책에 원가가 직접 묶입니다. DB 적중률을 올려 두는 것이 유일한 방어입니다</li>
            <li><b>판매처 데이터 의존</b> — 네이버 API 정책이 바뀌면 가격 · 이미지가 한 번에 끊깁니다</li>
            <li><b>초기 데이터 공백</b> — 지금 상태로 출시하면 대부분 미적중이라 원가가 높고 추천도 빈약합니다</li>
          </ul>
        </div>
      </section>

      {/* 06 권고 */}
      <section className={s.section}>
        <div className={s.num}>06</div>
        <div className={s.body}>
          <h2 className={s.h2}>권고</h2>
          <div className={p.callout}>
            <p className={s.p} style={{ margin: 0 }}>
              <b>기능은 충분합니다. 지금 필요한 것은 데이터와 인증입니다.</b>
            </p>
          </div>
          <ol className={p.steps}>
            <li><b>카탈로그 확장 지속</b> — {owned}종 보유, 매일 자동 수확 중 (비용 0원)</li>
            <li><b>로그인 · 19세 인증 · 사용량 제한</b> — 스토어 출시와 구독의 공통 선행 조건</li>
            <li><b>미검증 기능을 실기기로 확인</b> — 시연 사고 방지</li>
            <li><b>안주 제휴부터 연결</b> — 화면 변경 없이 붙는 유일한 수익원</li>
            <li><b>출시 후 스마트오더 제휴 협상</b> — 객단가를 올리는 지점</li>
            <li><b>광고는 사용자가 쌓인 뒤</b> — 초기에는 서버비도 안 나오면서 사용성만 해칩니다</li>
          </ol>
          <p className={s.p} style={{ marginTop: "1.6rem" }}>
            숫자 중 실측은 원가 부분(3장 첫 표)뿐입니다. 적중률 · 사용 빈도 · 제휴 수수료율은 가정이며,
            실제 운영 데이터가 쌓이면 다시 계산해야 합니다.
          </p>
        </div>
      </section>

      {/* 07 판매 전략 */}
      <section className={s.section}>
        <div className={s.num}>07</div>
        <div className={s.body}>
          <h2 className={s.h2}>판매 전략</h2>
          <p className={s.sub}>누구에게, 무엇을 앞세워, 어떤 순서로 파는가.</p>

          <h3 className={s.h4}>누구에게 — 세 부류</h3>
          <div className={s.scroll}>
            <table className={s.table}>
              <thead><tr><th>타깃</th><th>그들의 문제</th><th>우리가 앞세울 것</th></tr></thead>
              <tbody>
                <tr>
                  <td>와인 입문자</td>
                  <td className={s.was}>뭘 사야 할지 모르고, 물어보기 민망함</td>
                  <td className={s.now}>O·X 여덟 문항 첫날 추천 · 입문자/가격대 큐레이션</td>
                </tr>
                <tr>
                  <td>식당에서 고르는 사람</td>
                  <td className={s.was}>와인 리스트 앞에서 아는 게 없음</td>
                  <td className={s.now}>메뉴판 스캔 → 가성비 순 정렬 (국내 앱에 거의 없음)</td>
                </tr>
                <tr>
                  <td>모으는 애호가</td>
                  <td className={s.was}>보유 현황·시세·마실 때를 못 챙김</td>
                  <td className={s.now}>셀러 가치 · 가격 이력 · 특가/적기 알림</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className={s.h4} style={{ marginTop: "2rem" }}>한 줄 셀링 포인트</h3>
          <div className={p.callout}>
            <b>&ldquo;찍으면 아는 앱이 아니라, 찍을수록 똑똑해지는 앱.&rdquo;</b> {owned}종의 자체
            데이터베이스에서 즉시 답하고, 없는 술은 AI가 읽어 데이터베이스를 키웁니다. 경쟁자가
            베낄 수 있는 것은 기능이지 데이터가 아닙니다.
          </div>

          <h3 className={s.h4} style={{ marginTop: "2rem" }}>어떤 순서로 — 3단계</h3>
          <ol className={p.steps}>
            <li>
              <b>시연 · 클로즈드 베타</b> — 지인·와인 모임 단위로 배포. 이 기간에 미매칭 명단이
              쌓이고 카탈로그가 실사용 기준으로 여물어집니다. 광고비 0원.
            </li>
            <li>
              <b>공개 + 유입 장치 가동</b> — 공유 카드(결과를 인스타·카톡용 이미지로)가 광고비
              없는 유입 경로입니다. 보틀샵·와인바에 테이블 QR 제휴를 제안합니다: 손님은 리스트
              스캔으로 고르고, 매장은 설명 인력을 아낍니다.
            </li>
            <li>
              <b>수익화</b> — 안주 제휴 링크(화면 변경 없이 즉시) → 스마트오더 제휴(객단가 상승)
              → 구독(사용량 제한과 동시 도입). 광고는 사용자 규모가 생긴 뒤에만.
            </li>
          </ol>

          <h3 className={s.h4} style={{ marginTop: "2rem" }}>클라이언트 시연 대본 (5분)</h3>
          <ol className={p.steps}>
            <li><b>바코드 스캔</b> — 병 뒷면을 비추면 즉시 결과. &ldquo;이 조회는 비용이 0원입니다&rdquo;</li>
            <li><b>라벨 촬영</b> — DB에 없는 술로. 30초 분석 후 &ldquo;이제 이 술은 DB에 들어갔고, 다음 사람부터 무료입니다&rdquo;</li>
            <li><b>와인 리스트</b> — 실제 메뉴판 촬영 → 가성비 순 정렬. 경쟁 앱과 갈리는 장면</li>
            <li><b>셀러</b> — 담기 → 시세 갱신 → 가치 총액. &ldquo;알림은 목표가 도달·적기 임박 때 옵니다&rdquo;</li>
            <li><b>공유 카드</b> — 결과를 이미지로 → &ldquo;이게 사용자가 스스로 퍼뜨리는 광고입니다&rdquo;</li>
          </ol>

          <h3 className={s.h4} style={{ marginTop: "2rem" }}>경쟁 대응 문답</h3>
          <div className={s.scroll}>
            <table className={s.table}>
              <thead><tr><th>예상 질문</th><th>답</th></tr></thead>
              <tbody>
                <tr>
                  <td>Vivino 쓰면 되지 않나</td>
                  <td className={s.was}>Vivino는 한국 시세·판매처가 없고, 추천을 받으려면 여러 병을 마시고 평가해야 합니다. 우리는 국내 시세를 직접 조사해 갖고 있고, 문답 여덟 개로 첫날 추천하며, 안주까지 연결합니다</td>
                </tr>
                <tr>
                  <td>데이터가 계속 유지되나</td>
                  <td className={s.was}>매일 새벽 크론이 신상품을 자동 수확하고, 사용자가 찾은 미보유 술이 다음 확장 목록이 됩니다. 사람 손 없이 자랍니다</td>
                </tr>
                <tr>
                  <td>운영비는</td>
                  <td className={s.was}>고정비 사실상 0원(무료 티어 + 무료 API). 변동비는 DB 미적중 스캔뿐이고, 적중률이 오를수록 0원에 수렴합니다</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <footer className={p.footer}>
        내부 검토용 · 출시 시 <code>app/plan/</code> 폴더 삭제
      </footer>
    </div>
  );
}
