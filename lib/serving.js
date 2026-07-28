// 서빙 준비 시간은 술마다 다르다.
//
// 지금까지는 칠링 20분 / 디캔팅 60분 / 롱 디캔팅 120분을 모든 술에 똑같이 보여 주고 있었다.
// 그건 편의가 아니라 틀린 안내다.
//   - 스파클링을 디캔팅하면 기포가 날아간다. 권하면 안 되는 것을 권한 셈이다.
//   - 오래된 와인은 오래 열어 두면 향이 무너진다. 롱 디캔팅은 정확히 반대 조언이다.
//   - 위스키·소주에 디캔팅 버튼이 뜰 이유가 없다.
// 그래서 주종·타입·탄닌·빈티지를 보고 필요한 것만 만든다.

const OLD_YEARS = 12; // 이 이상 지난 와인은 향이 쉽게 무너진다

function subtypeOf(result) {
  const text = `${result.type || ""} ${result.name || ""}`;
  if (/스파클링|샴페인|샹동|프로세코|아스티|크레망|카바|브뤼/.test(text)) return "sparkling";
  if (/로제/.test(text)) return "rose";
  if (/화이트|샤르도네|소비뇽 블랑|리슬링|모스카토|피노 그리/.test(text)) return "white";
  if (/디저트|포트|셰리|아이스와인/.test(text)) return "dessert";
  return "red";
}

function axisValue(result, axis) {
  return (result.tasteProfile || []).find((a) => a.axis === axis)?.value ?? null;
}

function ageOf(result) {
  const year = parseInt(result.vintage, 10);
  if (!year || year < 1900) return null;
  return new Date().getFullYear() - year;
}

/**
 * 이 술에 필요한 준비만 골라 낸다.
 * @returns {{presets: object[], note: string|null, avoid: string|null}}
 */
export function servingPlan(result) {
  if (!result) return { presets: [], note: null, avoid: null };

  const chill = (min, hint) => ({
    kind: "chill",
    label: "칠링",
    min,
    hint,
    done: "차갑게 준비됐습니다",
  });
  const decant = (min, hint, kind = "decant") => ({
    kind,
    label: kind === "long" ? "롱 디캔팅" : "디캔팅",
    min,
    hint,
    done: kind === "long" ? "충분히 열렸습니다" : "향이 열렸습니다",
  });

  // ── 와인이 아닌 술
  if (result.category !== "wine") {
    if (result.category === "beer" || result.category === "soju") {
      return {
        presets: [chill(25, "냉장고에서 시원해질 때까지")],
        note: "차갑게 마실수록 좋은 술입니다.",
        avoid: null,
      };
    }
    if (result.category === "sake") {
      return {
        presets: [chill(20, "냉장고에서 (냉주로 마실 때)")],
        note: "따뜻하게 마시는 방식도 있으니 제원의 음용 온도를 참고하세요.",
        avoid: null,
      };
    }
    // 위스키·브랜디·진 등 — 디캔팅이나 칠링이 필요하지 않다
    return {
      presets: [decant(10, "잔에 따라 두고 향이 열리기까지", "decant")],
      note: "잔에 따라 잠시 두면 알코올이 날아가고 향이 또렷해집니다. 칠링이나 디캔팅은 필요하지 않습니다.",
      avoid: null,
    };
  }

  const kind = subtypeOf(result);
  const tannin = axisValue(result, "탄닌") ?? 40;
  const body = axisValue(result, "바디") ?? 55;
  const age = ageOf(result);

  // ── 스파클링: 차갑게만. 디캔팅은 해가 된다.
  if (kind === "sparkling") {
    return {
      presets: [chill(20, "얼음물에 담가 6~8℃까지")],
      note: "얼음과 물을 반씩 채운 통에 담그면 냉장고보다 훨씬 빠릅니다.",
      avoid: "디캔팅하면 기포가 날아갑니다. 병째 차갑게 두었다가 바로 따르세요.",
    };
  }

  // ── 디저트·주정강화
  if (kind === "dessert") {
    return {
      presets: [chill(25, "얼음물에서 8~10℃까지")],
      note: "달수록 조금 더 차갑게 마시면 단맛이 무겁지 않습니다.",
      avoid: null,
    };
  }

  // ── 화이트·로제: 칠링이 기본. 오크 숙성한 진한 화이트만 짧게 열어 준다.
  if (kind === "white" || kind === "rose") {
    const presets = [chill(20, "얼음물에서 8~10℃까지")];
    const oaked = body >= 60 || /오크|배럴/.test(`${result.type || ""} ${result.tastingNotes || ""}`);
    if (oaked) presets.push(decant(20, "묵직한 화이트는 잠시 열어 주면 좋습니다"));

    return {
      presets,
      note: "너무 차가우면 향이 닫힙니다. 꺼낸 뒤 잔에서 조금 올라오는 온도가 가장 좋습니다.",
      avoid: null,
    };
  }

  // ── 레드
  // 오래된 와인은 짧게. 병을 세워 침전물을 가라앉힌 뒤 조심히 옮기는 것이 목적이다.
  if (age != null && age >= OLD_YEARS) {
    return {
      presets: [decant(20, "침전물을 거르고 향을 살짝만 열기")],
      note: `${result.vintage}년산입니다. 오래된 와인은 공기와 오래 만나면 향이 빠르게 무너지므로 짧게 하고 바로 드세요.`,
      avoid: "롱 디캔팅은 권하지 않습니다.",
    };
  }

  const presets = [];

  // 가벼운 레드는 살짝 칠링하면 훨씬 산뜻하다 (보졸레·피노 누아 등)
  if (body <= 50) presets.push(chill(15, "가벼운 레드는 살짝 차갑게 (13~15℃)"));

  if (tannin >= 70) {
    presets.push(decant(90, "탄닌이 강해 충분히 열어야 합니다", "long"));
    presets.push(decant(45, "시간이 없다면 이만큼이라도"));
  } else if (tannin >= 48) {
    presets.push(decant(45, "향이 열리기까지"));
  } else {
    // 떫은맛이 약한 레드도 잠깐은 열어 주면 향이 산다.
    // 필요 없다고 아무것도 주지 않으면 화면이 비어 버린다.
    presets.push(decant(15, "가볍게 열어 주기"));
  }

  const note =
    tannin >= 70
      ? "탄닌이 강한 와인입니다. 디캔터가 없으면 잔에 따라 두고 가끔 흔들어 주어도 됩니다."
      : tannin < 30
        ? "떫은맛이 약해 오래 열어 둘 필요가 없습니다."
        : "디캔터가 없으면 잔에 따라 두는 것만으로도 도움이 됩니다.";

  return { presets, note, avoid: null };
}
