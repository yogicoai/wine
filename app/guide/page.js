import Link from "next/link";
import s from "./guide.module.css";

export const metadata = {
  title: "보틀 렌즈 — 기능 설명서",
  description: "술 라벨을 촬영하면 AI가 주종·가격·역사·페어링을 분석하고 구매까지 연결하는 웹 앱의 기능 설명서.",
};

export default function GuidePage() {
  return (
    <div className={s.wrap}>
      <div className={s.topbar}>
        <Link href="/" className={s.brand}>
          Bottle <em>Lens</em>
        </Link>
        <Link href="/" className={s.back}>
          앱으로 돌아가기
        </Link>
      </div>

      <header className={s.hero}>
        <p className={s.eyebrow}>제품 기능 설명서</p>
        <h1 className={s.title}>
          보틀 렌즈
          <span className={s.titleKo}>술 라벨을 읽는 AI 소믈리에</span>
        </h1>
        <p className={s.lede}>
          술병 라벨을 카메라로 찍으면 <b>AI가 그 술의 모든 것</b>을 읽어내고, 실제로 살 수 있는 곳까지
          연결합니다. 사전에 상품 데이터베이스를 만들 필요가 없습니다.
        </p>
        <div className={s.stats}>
          <div className={s.stat}><b>16</b><span>자동 판별 주종</span></div>
          <div className={s.stat}><b>0</b><span>사전 등록 상품 수</span></div>
          <div className={s.stat}><b>30초</b><span>스캔당 분석 시간</span></div>
          <div className={s.stat}><b>63원</b><span>스캔당 AI 비용</span></div>
        </div>
      </header>

      {/* 01 */}
      <section className={s.section}>
        <div className={s.num}>01</div>
        <div className={s.body}>
          <h2 className={s.h2}>어떤 앱인가</h2>
          <p className={s.sub}>
            와인 · 위스키 · 사케 · 전통주 · 막걸리 · 맥주 · 브랜디 · 백주 · 데킬라 · 럼 · 진 · 보드카 · 리큐르 ·
            하이볼(RTD) · 소주 · 기타 — 16개 주종으로 자동 분류합니다.
          </p>
          <p className={s.p}>
            여기서 16은 <b>인식할 수 있는 술의 가짓수가 아니라 결과를 정리하는 분류 체계</b>입니다. 주종에 따라
            아이콘, 맛 프로필의 축(와인은 탄닌·산도, 위스키는 피트·스파이스), 생산자 표기(와이너리·증류소·양조장)가
            달라집니다. 어떤 술이든 이 중 하나로 분류되어 그에 맞는 형식으로 보여집니다.
          </p>
          <p className={s.p}>
            핵심은 <b>상품 데이터를 미리 수집하지 않는다</b>는 점입니다. AI가 라벨의 글자와 디자인을 직접 읽어
            제품을 특정하고, 학습된 지식으로 역사·맛·페어링을 설명합니다. 가격처럼 자주 바뀌는 정보는
            네이버쇼핑에서 실시간으로 가져옵니다. 그래서 등록 작업 없이 세상의 거의 모든 술을 첫날부터 다룰 수 있습니다.
          </p>
          <div className={s.callout}>
            <b>정직한 AI로 설계했습니다.</b> 모르는 술을 그럴듯하게 지어내지 않도록, 스스로 얼마나 아는지를{" "}
            <b>확실한 정보 / 부분 확인 / 일반 추정</b> 세 단계로 표시합니다.
          </div>
        </div>
      </section>

      {/* 02 */}
      <section className={s.section}>
        <div className={s.num}>02</div>
        <div className={s.body}>
          <h2 className={s.h2}>인수받은 원본에서 달라진 점</h2>
          <p className={s.sub}>단일 HTML 파일로 되어 있던 원본을 상용 서비스 구조로 다시 지었습니다.</p>
          <div className={s.scroll}>
            <table className={s.table}>
              <thead>
                <tr><th>항목</th><th>원본</th><th>현재</th></tr>
              </thead>
              <tbody>
                <tr><td>구조</td><td className={s.was}>HTML 파일 1개</td><td className={s.now}>Next.js 웹 애플리케이션</td></tr>
                <tr><td>AI 호출</td><td className={s.was}>브라우저에서 직접 호출 — API 키가 사용자에게 노출</td><td className={s.now}><b>서버에서 호출</b> — 키가 외부에 노출되지 않음</td></tr>
                <tr><td>데이터 저장</td><td className={s.was}>브라우저 저장소 — 기기를 바꾸면 사라짐</td><td className={s.now}><b>MongoDB</b> — 영구 보관, 기기 무관</td></tr>
                <tr><td>구매 연결</td><td className={s.was}>없음</td><td className={s.now}><b>실제 판매처 · 최저가 · 구매 링크</b></td></tr>
                <tr><td>개인 기록</td><td className={s.was}>최근 스캔 40건</td><td className={s.now}><b>나의 셀러</b> — 재고 · 별점 · 테이스팅 노트 · 취향 분석</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 03 */}
      <section className={s.section}>
        <div className={s.num}>03</div>
        <div className={s.body}>
          <h2 className={s.h2}>화면별 사용법</h2>
          <p className={s.sub}>촬영 → 분석 → 결과 → 기록, 그리고 사진 없이 찾는 길까지.</p>
          <div className={s.screens}>
            <div className={s.screen}>
              <span className={s.tag}>Screen 1</span>
              <h3 className={s.h4}>촬영</h3>
              <p className={s.p}>
                화면 위쪽에서 <b>라벨 촬영 · 바코드 · 와인 리스트</b> 세 가지 방식 중 하나를 고릅니다.
              </p>
              <ul className={s.list}>
                <li><b>라벨 촬영</b> — 기본. 병 앞면 라벨을 찍습니다</li>
                <li>
                  <b>바코드</b> — 병 뒷면 바코드를 비추면 셔터를 누를 필요 없이 자동으로 인식합니다.
                  AI를 부르지 않으므로 <b>비용이 들지 않습니다</b>
                </li>
                <li>
                  <b>와인 리스트</b> — 식당 메뉴판을 통째로 찍으면 적힌 술을 모두 뽑아
                  <b> 가성비 순으로 정렬</b>해 드립니다
                </li>
              </ul>
              <ul className={s.list} style={{ marginTop: "0.9rem" }}>
                <li><b>사진 업로드</b> — 왼쪽 갤러리 버튼</li>
                <li><b>드래그 앤 드롭</b> — PC에서 이미지를 끌어다 놓기</li>
                <li><b>붙여넣기</b> — 복사한 이미지를 Ctrl+V</li>
              </ul>
              <p className={s.p} style={{ marginTop: "0.9rem" }}>
                카메라는 보안 정책상 HTTPS 주소에서만 열립니다. 배포하면 자동으로 해결되며, 그전에는 사진 업로드로 사용하시면 됩니다.
              </p>
            </div>

            <div className={s.screen}>
              <span className={s.tag}>Screen 2</span>
              <h3 className={s.h4}>분석 중</h3>
              <p className={s.p}>
                라벨을 읽고 주종을 판별한 뒤 결과를 정리합니다. 약 30초 걸립니다.
                가격 정보는 결과 화면에서 네이버쇼핑을 통해 실시간으로 함께 조회됩니다.
              </p>
            </div>

            <div className={s.screen}>
              <span className={s.tag}>Screen 3</span>
              <h3 className={s.h4}>결과</h3>
              <p className={s.p}>분석 결과가 잡지 화보 형태로 정리됩니다.</p>
              <ul className={s.list}>
                <li><b>제품 정보</b> — 이름 · 생산자 · 빈티지 · 지역 · 도수, 인식 신뢰도</li>
                <li><b>사용자 평점</b> — 사용자들이 남긴 별점의 평균과 분포</li>
                <li><b>예상 가격</b> — 국내 가격대와 5단계 등급</li>
                <li><b>구매 정보</b> — 판매처의 실제 상품 사진 · 최저가 · 구매 링크</li>
                <li><b>빈티지별 가격</b> — 같은 술의 연도별 가격 비교</li>
                <li><b>플레이버 시그니처</b> — 주종에 맞는 4개 축 맛 프로필</li>
                <li><b>음용 적기</b> — 언제부터 언제까지, 피크 시점</li>
                <li><b>히스토리 · 스토리 · 생산자</b> — 이 술의 연대기와 이야기</li>
                <li><b>푸드 페어링</b> — 어울리는 음식과 그 음식을 살 수 있는 링크</li>
                <li><b>평점 · 서빙 · 상식 · 음용 팁</b></li>
                <li><b>타이머</b> — 칠링 20분 / 디캔팅 60분 / 롱 디캔팅 120분</li>
                <li><b>유사주 추천</b> — 이름을 누르면 그 술도 바로 분석</li>
                <li><b>이미지로 공유</b> — 결과를 카드 한 장으로 만들어 인스타 · 카톡에 그대로 올리기</li>
              </ul>
            </div>

            <div className={s.screen}>
              <span className={s.tag}>Screen 4</span>
              <h3 className={s.h4}>나의 셀러</h3>
              <p className={s.p}>헤더의 와인잔 아이콘에서 열립니다. 애호가를 위한 개인 기록 공간입니다.</p>
              <ul className={s.list}>
                <li><b>요약</b> — 보유 병 수 / 마신 술 / 위시리스트</li>
                <li>
                  <b>특가 알림</b> — 목표가에 도달하거나 최저가가 떨어지면 화면 상단에 표시되고,
                  알림을 켜 두면 앱을 닫아 두어도 <b>휴대폰으로 알려드립니다</b> (매일 자동 점검)
                </li>
                <li>
                  <b>셀러 가치</b> — 보유 중인 술의 현재 최저가를 합산한 총액.
                  시세를 아직 구하지 못한 병은 따로 밝히고, <b>[시세 갱신]</b> 버튼으로 그 자리에서 채울 수 있습니다
                </li>
                <li><b>가격 이력</b> — 매일 확인한 최저가를 최대 90일치 그래프로. “관찰 이래 최저”인지 한눈에 보입니다</li>
                <li><b>나의 취향</b> — 별점 기록을 분석해 “탄닌 강한 · 바디 강한 스타일을 선호합니다” 같은 취향 레이더 생성</li>
                <li><b>재고 관리</b> — 병 수 증감, 마시면 자동 차감</li>
                <li>
                  <b>음용 적기</b> — 지금이 피크 / 곧 적기 마감 / 적기 지남을 배지로 표시하고,
                  <b> 때가 되면 먼저 알려드립니다</b>
                </li>
                <li><b>테이스팅 노트</b> — 마신 날짜, 별점, 느낀 향 태그, 메모</li>
              </ul>
              <p className={s.p} style={{ marginTop: "0.9rem" }}>
                향 태그는 주종에 따라 다르게 제공됩니다. 와인은 블랙베리 · 제비꽃 · 삼나무, 위스키는 피트 · 훈연 · 요오드처럼
                타이핑 없이 눌러서 기록합니다.
              </p>
              <p className={s.p} style={{ marginTop: "0.9rem" }}>
                가격 이력은 하루 한 점씩 쌓이는 값이라, 셀러에 처음 담은 날에는 그래프가 없습니다.
                <b> [시세 갱신]</b>을 누르면 현재 최저가가 바로 채워지고, 선그래프는 이틀째부터 그려집니다.
              </p>
            </div>

            <div className={s.screen}>
              <span className={s.tag}>Screen 5</span>
              <h3 className={s.h4}>찾기 · 추천</h3>
              <p className={s.p}>
                사진을 찍을 상황이 아닐 때 — 집에서 고를 때, 선물을 찾을 때 — 쓰는 화면입니다.
                전부 우리 데이터베이스만 읽으므로 <b>AI 비용이 들지 않습니다</b>.
              </p>
              <ul className={s.list}>
                <li>
                  <b>이름으로 찾기</b> — 이름 · 생산자 · 산지 · 품종. “샤또딸보”처럼 붙여 써도,
                  “칠레”나 “보르도”처럼 산지로도 찾힙니다
                </li>
                <li>
                  <b>취향 문답</b> — O · X 여덟 문항, 30초. 떫은맛 · 단맛 · 무게감 · 산미 · 예산을 묻고
                  취향에 맞는 와인을 골라 드립니다
                </li>
                <li><b>입문자 추천</b> — 떫은맛이 적고 값이 부담 없는 순서로</li>
                <li><b>가격대별 추천</b> — 2만원 이하부터 30만원 이상까지 다섯 단</li>
              </ul>
              <p className={s.p} style={{ marginTop: "0.9rem" }}>
                <b>왜 문답이 필요한가.</b> 기록으로 취향을 뽑는 방식은 별점이 두 개 이상 쌓여야
                동작합니다. 처음 온 사람에게는 아무것도 줄 수 없다는 뜻입니다. 문답이 있으면 첫날부터
                추천이 나오고, 기록이 쌓이면 기록 쪽에 점점 더 무게가 실립니다. Vivino는 추천을 받으려면
                먼저 여러 병을 마시고 평가해야 합니다.
              </p>
              <p className={s.p} style={{ marginTop: "0.9rem" }}>
                추천마다 <b>왜 골랐는지</b> 한 줄이 붙습니다. “약한 탄닌이 취향과 맞습니다”처럼요.
                근거 없는 추천은 신뢰를 얻지 못합니다.
              </p>
            </div>

            <div className={s.screen}>
              <span className={s.tag}>Screen 6</span>
              <h3 className={s.h4}>와인 리스트</h3>
              <p className={s.p}>
                식당에서 와인 리스트를 받았을 때 진짜 문제는 “뭘 시켜야 하나”입니다.
                메뉴판을 한 장 찍으면 적힌 항목을 모두 뽑아 정리해 드립니다.
              </p>
              <ul className={s.list}>
                <li><b>가성비 판정</b> — 메뉴 가격을 온라인 최저가와 견주어 배수를 냅니다</li>
                <li><b>정렬</b> — 가성비 순 / 평점 순 / 가격 순</li>
                <li><b>사용자 평점</b> — 우리 DB에 있는 술은 별점을 함께 보여줍니다</li>
                <li><b>자세히</b> — 누르면 그 술의 전체 분석으로 이동합니다</li>
              </ul>
              <p className={s.p} style={{ marginTop: "0.9rem" }}>
                와인은 통상 시중가의 2~3배가 식당 관행이라, 2배 아래면 값이 좋은 편입니다.
                항목이 10개든 30개든 AI 호출은 한 번이라 원가가 늘지 않습니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 04 */}
      <section className={s.section}>
        <div className={s.num}>04</div>
        <div className={s.body}>
          <h2 className={s.h2}>이 앱만의 차별점</h2>
          <p className={s.sub}>경쟁 서비스와 갈리는 지점입니다.</p>

          <div className={s.edge}>
            <h3 className={s.h4}>사전 데이터 구축이 필요 없다</h3>
            <p className={s.p}>상품 DB를 만들거나 관리할 인력이 들지 않습니다. 등록되지 않은 술이라는 개념 자체가 없습니다.</p>
          </div>
          <div className={s.edge}>
            <h3 className={s.h4}>정보에서 끝나지 않고 구매처까지 안내한다</h3>
            <p className={s.p}>
              실제 판매처의 상품 사진과 현재 가격을 함께 보여주고, 누르면 해당 판매 페이지로 이동합니다.
              직접 판매하는 것은 아니며, 어디서 얼마에 파는지를 찾아 주는 역할입니다.
            </p>
          </div>
          <div className={s.edge}>
            <h3 className={s.h4}>안주까지 함께 소개한다</h3>
            <p className={s.p}>
              “스테이크와 어울립니다”에서 멈추지 않고, 그에 해당하는 실제 식품이 어떤 것이 있고 대략 얼마인지까지
              보여줍니다. 나중에 제휴를 붙인다면 객단가를 높일 수 있는 지점이기도 합니다.
            </p>
          </div>
          <div className={s.edge}>
            <h3 className={s.h4}>모르는 것을 지어내지 않는다</h3>
            <p className={s.p}>확신 정도를 신뢰도로 표시하고, 가격은 실제 판매 데이터로 확인합니다.</p>
          </div>
          <div className={s.edge}>
            <h3 className={s.h4}>기록이 쌓일수록 개인화된다</h3>
            <p className={s.p}>별점과 테이스팅 노트가 모여 취향 프로필이 되고, 이는 추천 정확도의 기반이 됩니다.</p>
          </div>
          <div className={s.edge}>
            <h3 className={s.h4}>첫날부터 추천을 받는다</h3>
            <p className={s.p}>
              Vivino에서 추천을 받으려면 먼저 여러 병을 마시고 평가해야 합니다. 우리는 O · X 여덟
              문항이면 됩니다. 기록이 쌓이면 그쪽에 점점 더 무게가 실리므로, 쓸수록 정확해지는 것은
              같으면서 시작점이 다릅니다.
            </p>
          </div>
          <div className={s.edge}>
            <h3 className={s.h4}>식당에서 쓸 수 있다</h3>
            <p className={s.p}>
              와인 리스트를 통째로 읽어 가성비 순으로 세우는 기능은 국내 앱에서 찾기 어렵습니다.
              “집에서 정보를 찾는 앱”이 아니라 “주문하기 직전에 꺼내는 앱”이 되는 지점입니다.
            </p>
          </div>

          <h3 className={s.h4} style={{ marginTop: "2rem" }}>경쟁 앱 대비 위치</h3>
          <div className={s.scroll}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>앱</th>
                  <th>핵심 무기</th>
                  <th>우리 상태</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Vivino</td>
                  <td>사용자 집단 평점, 와인 리스트 스캔</td>
                  <td>리스트 스캔 보유 · 평점은 축적 시작 · 추천은 첫날부터</td>
                </tr>
                <tr>
                  <td>Wine-Searcher</td>
                  <td>전 세계 시세와 가격 이력</td>
                  <td>국내 최저가 + 90일 이력 보유</td>
                </tr>
                <tr>
                  <td>CellarTracker</td>
                  <td>셀러 관리, 보유분 가치 평가</td>
                  <td>셀러 · 가치 평가 · 적기 알림 모두 보유</td>
                </tr>
                <tr>
                  <td>Delectable</td>
                  <td>소믈리에 팔로우 피드</td>
                  <td>미구현</td>
                </tr>
                <tr>
                  <td>데일리샷</td>
                  <td>근처 매장 픽업 예약</td>
                  <td>미구현 (제휴 필요)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className={s.p} style={{ marginTop: "1rem" }}>
            집단 평점은 하루아침에 만들 수 없는 자산입니다. Vivino가 10년에 걸쳐 쌓은 것이라
            <b> 오늘부터 모아야</b> 1년 뒤에 값이 생깁니다. 그래서 사용자가 적은 지금부터 별점을
            술 단위로 집계해 두었습니다.
          </p>
        </div>
      </section>

      {/* 05 */}
      <section className={s.section}>
        <div className={s.num}>05</div>
        <div className={s.body}>
          <h2 className={s.h2}>운영에 필요한 것</h2>
          <p className={s.sub}>설정 파일에 세 종류의 값만 넣으면 동작합니다.</p>
          <div className={s.scroll}>
            <table className={s.table}>
              <thead><tr><th>항목</th><th>용도</th><th>발급처</th></tr></thead>
              <tbody>
                <tr><td>Anthropic API 키</td><td className={s.now}>AI 분석</td><td className={s.was}>console.anthropic.com</td></tr>
                <tr><td>MongoDB 주소</td><td className={s.now}>데이터 저장</td><td className={s.was}>MongoDB Atlas</td></tr>
                <tr><td>네이버 검색 키</td><td className={s.now}>상품 · 가격 조회</td><td className={s.was}>developers.naver.com (무료)</td></tr>
              </tbody>
            </table>
          </div>
          <p className={s.p}>
            <b>키가 없어도 동작합니다.</b> AI 키가 없으면 샘플 4종이 순환하는 데모 모드로 화면을 확인할 수 있고,
            네이버 키가 없으면 구매 정보만 빠진 채 나머지는 정상 동작합니다.
          </p>
        </div>
      </section>

      {/* 06 */}
      <section className={s.section}>
        <div className={s.num}>06</div>
        <div className={s.body}>
          <h2 className={s.h2}>AI 사용 비용 — 실측</h2>
          <p className={s.sub}>
            2026년 7월 27일, 실제 스캔을 돌려 토큰 사용량을 측정한 값입니다. Claude Sonnet 5 기준, 환율 1,450원 가정.
          </p>

          <div className={s.scroll}>
            <table className={s.table}>
              <thead>
                <tr><th>구분</th><th>입력 토큰</th><th>출력 토큰</th><th>소요 시간</th><th>스캔 1회</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>웹 검색 끔<br /><span className={s.faint}>현재 기본 설정</span></td>
                  <td className={s.numCell}>2,860</td>
                  <td className={s.numCell}>2,304</td>
                  <td className={s.numCell}>30초</td>
                  <td className={`${s.numCell} ${s.priceLo}`}>약 63원</td>
                </tr>
                <tr>
                  <td>웹 검색 켬</td>
                  <td className={s.numCell}>78,411</td>
                  <td className={s.numCell}>6,129</td>
                  <td className={s.numCell}>179초</td>
                  <td className={`${s.numCell} ${s.priceHi}`}>약 474원</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className={s.callout}>
            <b>웹 검색을 켜면 비용이 7배, 시간이 6배로 늘어납니다.</b> 검색 결과 텍스트가 입력 토큰을 76,000개나
            차지하기 때문입니다. 그런데 검색이 주로 찾아오는 가격 정보는 <b>이미 무료인 네이버쇼핑 조회가 담당</b>하고
            있어 상당 부분 중복이었습니다. 그래서 <b>웹 검색은 완전히 꺼 둔 상태</b>입니다. 예상치 못한 비용이 나가지
            않도록 화면에서 감췄을 뿐 아니라 서버에서도 차단해 두었고, 필요해지면 설정값 하나로 되살릴 수 있습니다.
          </div>

          <h3 className={s.h3}>월간 예상 비용</h3>
          <div className={s.scroll}>
            <table className={s.table}>
              <thead><tr><th>월 스캔 수</th><th>현재 설정 (검색 끔)</th><th>검색을 켠다면</th></tr></thead>
              <tbody>
                <tr><td>100회</td><td className={`${s.numCell} ${s.priceLo}`}>약 6천원</td><td className={s.numCell}>약 5만원</td></tr>
                <tr><td>1,000회</td><td className={`${s.numCell} ${s.priceLo}`}>약 6만원</td><td className={s.numCell}>약 52만원</td></tr>
                <tr><td>10,000회</td><td className={`${s.numCell} ${s.priceLo}`}>약 63만원</td><td className={`${s.numCell} ${s.priceHi}`}>약 516만원</td></tr>
              </tbody>
            </table>
          </div>
          <p className={s.p}>
            프로모션 단가(2026년 8월 31일까지)를 적용하면 각각 42원 / 316원으로 더 낮아집니다.
            웹 검색을 켤 경우 검색 도구 자체 요금이 별도로 부과되며, 정확한 단가는 Anthropic 요금표에서 확인이 필요합니다.
          </p>

          <h3 className={s.h3}>비용을 더 줄이는 방법</h3>
          <ul className={s.list}>
            <li>
              <b>결과 캐싱 (다음 작업 예정)</b> — 이미 스캔된 술은 재분석 없이 즉시 응답하므로 <b>비용 0원</b>.
              인기 있는 술이 스캔의 대부분을 차지하므로 효과가 가장 큽니다.
            </li>
            <li><b>저비용 모델 전환</b> — 잘 알려진 술은 저비용 모델로 처리하는 2단계 구조를 둡니다.</li>
            <li><b>사용량 제한</b> — 무료 사용자의 월 스캔 횟수를 제한합니다.</li>
          </ul>

          <h3 className={s.h3}>그 외 비용</h3>
          <ul className={s.list}>
            <li><b>네이버쇼핑 검색</b> — 무료 (일 25,000회)</li>
            <li><b>데이터베이스</b> — 무료 티어로 초기 운영 가능</li>
          </ul>
        </div>
      </section>

      {/* 07 */}
      <section className={s.section}>
        <div className={s.num}>07</div>
        <div className={s.body}>
          <h2 className={s.h2}>토큰 비용을 어떻게 회수할 것인가</h2>
          <p className={s.sub}>
            스캔 한 번에 AI 비용이 발생하므로, 그 비용을 누가 어떻게 부담할지가 사업 구조의 핵심입니다.
            아래 숫자는 모두 실측값에 근거합니다.
          </p>

          <h3 className={s.h3}>먼저, 원가는 사용할수록 내려갑니다</h3>
          <p className={s.p}>
            분석한 술은 카탈로그에 쌓여 다음 사람에게는 다시 분석하지 않고 제공됩니다. 사진 스캔의 경우 저비용 모델이
            라벨에서 제품명만 읽어 카탈로그를 조회하므로, 이미 있는 술이면 <b>약 3원</b>으로 끝납니다.
          </p>
          <div className={s.scroll}>
            <table className={s.table}>
              <thead>
                <tr><th>상황</th><th>AI 호출</th><th>스캔 1회 원가</th></tr>
              </thead>
              <tbody>
                <tr><td>카탈로그에 있음<br /><span className={s.faint}>사진 스캔</span></td><td className={s.was}>라벨 판독만</td><td className={`${s.numCell} ${s.priceLo}`}>약 3원</td></tr>
                <tr><td>카탈로그에 있음<br /><span className={s.faint}>이름 검색</span></td><td className={s.was}>없음</td><td className={`${s.numCell} ${s.priceLo}`}>0원</td></tr>
                <tr><td>카탈로그에 없음</td><td className={s.was}>판독 + 본분석</td><td className={s.numCell}>약 66원</td></tr>
                <tr><td>웹 검색 분석<br /><span className={s.faint}>현재 꺼둠</span></td><td className={s.was}>웹 검색 포함</td><td className={`${s.numCell} ${s.priceHi}`}>약 474원</td></tr>
              </tbody>
            </table>
          </div>

          <h3 className={s.h3}>카탈로그 적중률에 따른 평균 원가</h3>
          <div className={s.scroll}>
            <table className={s.table}>
              <thead>
                <tr><th>적중률</th><th>스캔 평균 원가</th><th>월 1만 회</th><th>시점</th></tr>
              </thead>
              <tbody>
                <tr><td>0%</td><td className={s.numCell}>66원</td><td className={s.numCell}>66만원</td><td className={s.was}>선적재 전</td></tr>
                <tr><td>50%</td><td className={s.numCell}>34원</td><td className={s.numCell}>34만원</td><td className={s.was}>초기 운영</td></tr>
                <tr><td>80%</td><td className={`${s.numCell} ${s.priceLo}`}>16원</td><td className={`${s.numCell} ${s.priceLo}`}>16만원</td><td className={s.now}>선적재 + 누적</td></tr>
                <tr><td>90%</td><td className={`${s.numCell} ${s.priceLo}`}>9원</td><td className={`${s.numCell} ${s.priceLo}`}>9만원</td><td className={s.now}>성숙 단계</td></tr>
              </tbody>
            </table>
          </div>
          <div className={s.callout}>
            인기 있는 술이 스캔의 대부분을 차지하므로 적중률은 빠르게 올라갑니다. 인기 상품 500종을 미리 채워 넣는
            데 드는 비용은 <b>약 1만 6천원(건당 32원, 배치 할인 적용)</b>이며, 한 번만 지출하면 됩니다.
          </div>

          <h3 className={s.h3}>판매 방식 — 세 가지 선택지</h3>
          <div className={s.prio}>
            <div className={s.item}>
              <h4 className={s.h4}>정액 구독제</h4>
              <span className={`${s.flag} ${s.must}`}>권장</span>
              <p className={s.p}>
                매출이 예측 가능하고 사용자도 부담을 미리 압니다. 원가가 스캔당 10~20원 수준이라 마진이 매우 큽니다.
                무료 구간을 함께 두어 유입을 확보합니다.
              </p>
            </div>
            <div className={s.item}>
              <h4 className={s.h4}>횟수제 (크레딧)</h4>
              <span className={`${s.flag} ${s.soon}`}>보조</span>
              <p className={s.p}>
                가끔 쓰는 사용자를 위한 선택지입니다. 예: 10회 1,000원. 구독을 부담스러워하는 층을 흡수하지만,
                결제 빈도가 낮아 주력으로는 적합하지 않습니다.
              </p>
            </div>
            <div className={s.item}>
              <h4 className={s.h4}>완전 무료 + 제휴 수수료</h4>
              <span className={`${s.flag} ${s.idea}`}>병행</span>
              <p className={s.p}>
                원가가 낮아 가능한 전략입니다. 구매 링크에서 발생하는 수수료로 비용을 회수합니다.
                특히 안주(식품)는 온라인 판매 제한이 없어 제휴가 수월합니다.
              </p>
            </div>
          </div>

          <h3 className={s.h3}>제안하는 요금제</h3>
          <div className={s.scroll}>
            <table className={s.table}>
              <thead>
                <tr><th>구간</th><th>가격</th><th>제공</th><th>월 원가<span className={s.faint}> (적중률 80%)</span></th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>무료</td>
                  <td className={s.numCell}>0원</td>
                  <td className={s.was}>월 5회 스캔, 셀러 10병, 특가 알림 3종</td>
                  <td className={s.numCell}>약 80원</td>
                </tr>
                <tr>
                  <td>스탠다드</td>
                  <td className={`${s.numCell} ${s.priceLo}`}>3,900원</td>
                  <td className={s.was}>월 50회 스캔, 셀러·특가 알림 무제한</td>
                  <td className={s.numCell}>약 800원</td>
                </tr>
                <tr>
                  <td>프리미엄</td>
                  <td className={`${s.numCell} ${s.priceLo}`}>9,900원</td>
                  <td className={s.was}>무제한(월 300회 공정사용), 최신 정보 검색 월 10회 포함</td>
                  <td className={s.numCell}>약 9,500원</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className={s.p}>
            실제 사용자는 대부분 한도를 다 쓰지 않습니다. 스탠다드 구독자가 월 20회를 스캔한다고 보면 원가는
            <b> 약 320원</b>으로, 마진율이 90%를 넘습니다. 프리미엄의 원가가 높아 보이는 이유는 웹 검색(회당 474원)이
            포함되기 때문이며, 이 기능만 별도 한도로 묶어 두면 비용이 통제됩니다.
          </p>

          <h3 className={s.h3}>무료 사용자는 어떻게 감당하나</h3>
          <p className={s.p}>
            무료 사용자 한 명의 월 원가는 <b>약 80원</b>입니다. 구매 링크에서 수수료가 한 번만 발생해도
            수십 명분을 회수합니다. 안주 상품(식품)은 온라인 판매 제한이 없어 일반 제휴 프로그램을 그대로 쓸 수 있고,
            주류는 매장 픽업 서비스와의 제휴가 현실적인 경로입니다.
          </p>

          <h3 className={s.h3}>B2B — 마진이 가장 큰 영역</h3>
          <ul className={s.list}>
            <li><b>보틀샵·마트 위젯</b> — 매대 QR로 상품 정보를 보여주는 서비스. 월 구독형으로 판매합니다.</li>
            <li><b>분석 API 판매</b> — 주류 이커머스에 건당 과금. 원가 16원 수준이므로 건당 200원에 팔아도 경쟁력이 있습니다.</li>
            <li><b>주류사 스폰서</b> — 특정 브랜드의 상세 콘텐츠나 신제품 노출을 유료화합니다.</li>
          </ul>

          <h3 className={s.h3}>AI 외 고정비</h3>
          <div className={s.scroll}>
            <table className={s.table}>
              <thead><tr><th>항목</th><th>초기</th><th>확장 시</th></tr></thead>
              <tbody>
                <tr><td>네이버쇼핑 조회</td><td className={s.now}>무료</td><td className={s.now}>무료 (일 25,000회)</td></tr>
                <tr><td>이미지 저장</td><td className={s.now}>기존 Cafe24 호스팅 활용</td><td className={s.now}>추가 비용 없음</td></tr>
                <tr><td>데이터베이스</td><td className={s.now}>무료 티어</td><td className={s.was}>월 8만원 수준</td></tr>
                <tr><td>웹 서버</td><td className={s.now}>무료 티어</td><td className={s.was}>월 3만원 수준</td></tr>
              </tbody>
            </table>
          </div>

          <div className={s.callout}>
            <b>정리하면.</b> 원가 구조상 스캔 한 번이 10~20원이므로, 월 3,900원 구독 하나로 사용자 한 명의 AI 비용을
            여유 있게 감당합니다. 관건은 요금이 아니라 <b>사용자를 모으는 것</b>이며, 그래서 무료 구간과 공유 카드가
            요금제만큼 중요합니다.
          </div>
        </div>
      </section>

      {/* 08 */}
      <section className={s.section}>
        <div className={s.num}>08</div>
        <div className={s.body}>
          <h2 className={s.h2}>이미지 저장과 저작권</h2>
          <p className={s.sub}>어떤 이미지를 어디에 두는지, 그리고 남의 이미지를 어떻게 다루는지.</p>
          <div className={s.scroll}>
            <table className={s.table}>
              <thead><tr><th>이미지</th><th>저장 위치</th><th>소유</th></tr></thead>
              <tbody>
                <tr>
                  <td>스캔 썸네일<br /><span className={s.faint}>320px</span></td>
                  <td className={s.now}><b>Cafe24 오픈호스팅</b> — DB에는 주소만</td>
                  <td className={s.was}>사용자 촬영</td>
                </tr>
                <tr>
                  <td>배경 · 아이콘</td>
                  <td className={s.now}>앱 소스에 포함</td>
                  <td className={s.was}>우리 자산</td>
                </tr>
                <tr>
                  <td>판매처 상품 사진</td>
                  <td className={s.now}><b>저장하지 않음</b> — 주소만 연결</td>
                  <td className={s.was}>판매자 소유</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className={s.p}>
            이미지를 데이터베이스에 문자열로 넣으면 문서 용량이 커져 조회가 느려지고, 무료 티어 용량(512MB)을 빠르게
            소진합니다. 썸네일 한 장이 약 20~40KB이므로 1만 건이면 200~400MB에 이릅니다. 지금은 주소만 저장하므로
            그 부담이 없고, 이미지는 Cafe24 웹서버가 직접 전송해 로딩도 빠릅니다.
          </p>

          <h3 className={s.h4} style={{ marginTop: "2rem" }}>판매처 이미지 취급 원칙</h3>
          <p className={s.p}>
            네이버쇼핑에서 받은 상품 사진은 판매자의 저작물이고, 이미지 안에 다른 서비스 로고나 홍보 문구가 합성되어
            있는 경우가 많습니다. 그래서 쓰는 자리를 나눠 두었습니다.
          </p>
          <div className={s.scroll}>
            <table className={s.table}>
              <thead><tr><th>자리</th><th>사용</th><th>이유</th></tr></thead>
              <tbody>
                <tr>
                  <td>구매 정보 카드</td>
                  <td className={s.now}>사용</td>
                  <td className={s.was}>판매처 이름 · 가격 · 링크가 함께 붙어 출처가 명확합니다</td>
                </tr>
                <tr>
                  <td>결과 대표 이미지</td>
                  <td className={s.now}>사용 <span className={s.faint}>(“판매처 제공 이미지” 표기)</span></td>
                  <td className={s.was}>우리가 촬영한 사진이 아님을 밝힙니다</td>
                </tr>
                <tr>
                  <td>공유 카드</td>
                  <td className={s.now}><b>사용 안 함</b></td>
                  <td className={s.was}>
                    우리가 만들어 배포하는 결과물입니다. 출처 없이 퍼지고 타사 로고까지 함께 나갑니다.
                    촬영 사진이나 주종 엠블럼만 씁니다
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className={s.p}>
            기술적으로도 판매처 이미지는 우리 서버를 거치지 않습니다. 브라우저가 판매처 주소에서 직접 불러오는
            링크일 뿐이며, 이미지 중계는 우리 호스팅만 허용합니다. 남의 이미지를 우리 서버가 다시 내보내면
            링크가 아니라 복제에 가까워지기 때문입니다.
          </p>
          <p className={s.p}>
            <b>확인이 필요한 사항.</b> 네이버 오픈 API 이용약관의 출처 표기 · 이미지 사용 조건은 정식 오픈 전에
            한 번 직접 확인하시기 바랍니다. 위 구조는 위험을 줄이기 위한 것이며 법률 검토를 대신하지 않습니다.
          </p>
        </div>
      </section>

      {/* 09 */}
      <section className={s.section}>
        <div className={s.num}>09</div>
        <div className={s.body}>
          <h2 className={s.h2}>다음 단계</h2>
          <p className={s.sub}>상업 서비스로 가기 위해 권장하는 순서입니다.</p>

          <h3 className={s.h4}>이미 반영된 항목</h3>
          <p className={s.p} style={{ marginBottom: "1.6rem" }}>
            앞서 제안드렸던 <b>결과 캐싱</b>(같은 술 재스캔 시 AI 호출 없이 즉시 응답),
            <b> 공유 카드</b>, <b>이미지 저장소 이전</b>(Cafe24 호스팅), <b>모바일 앱화</b>는 반영을 마쳤습니다.
            여기에 <b>가격 이력 · 셀러 가치 평가 · 바코드 스캔 · 사용자 평점 · 음용 적기 알림 ·
            와인 리스트 스캔 · 맞춤 추천 · 이름 검색</b>이 더해졌으며, 와인 리스트 스캔을 뺀
            나머지는 모두 <b>추가 AI 비용 없이</b> 동작합니다.
          </p>

          <div className={s.prio}>
            <div className={s.item}>
              <h3 className={s.h4}>로그인 · 만 19세 인증 · 사용량 제한</h3>
              <span className={`${s.flag} ${s.must}`}>상업화 필수</span>
              <p className={s.p}>
                현재는 기록이 공용입니다. 사용자별 셀러를 만들려면 로그인이 필요하고, 주류 서비스는 청소년보호법상 성인
                확인과 음주 경고 문구가 필요하며 앱스토어 심사에서도 확인합니다. 카카오 · 네이버 소셜 로그인으로 1차
                확인 후 정식 서비스에는 본인인증 연동을 권장합니다. 무료 사용자의 스캔 횟수를 제한하지 않으면 AI 비용이
                그대로 적자가 됩니다.
              </p>
            </div>

            <div className={s.item}>
              <h3 className={s.h4}>데이터베이스 확장</h3>
              <span className={`${s.flag} ${s.must}`}>최우선</span>
              <p className={s.p}>
                현재 56종(와인 43종)입니다. 추천과 검색의 품질은 결국 여기에 달려 있습니다. 스캔이
                쌓이면 자동으로 늘지만, 초기에는 직접 채워 넣는 편이 빠릅니다. AI 호출 없이 작성하므로
                추가 비용이 들지 않습니다.
              </p>
            </div>

            <div className={s.item}>
              <h3 className={s.h4}>수익 모델</h3>
              <span className={`${s.flag} ${s.soon}`}>권장</span>
              <p className={s.p}>
                구독제(무료 월 N회 / 프리미엄 무제한), 구매 연결 제휴 수수료, 보틀샵 · 마트용 위젯이나 주류 이커머스 대상
                분석 API 판매.
              </p>
            </div>

            <div className={s.item}>
              <h3 className={s.h4}>오프라인 매장 재고 · 픽업</h3>
              <span className={`${s.flag} ${s.idea}`}>아이디어</span>
              <p className={s.p}>
                국내법상 일반 주류는 배송이 불가해, 근처 매장 재고를 보여주고 픽업으로 연결하는 것이 실질적인 구매
                전환 경로입니다. 다만 매장 제휴가 선행되어야 합니다.
              </p>
            </div>

            <div className={s.item}>
              <h3 className={s.h4}>다국어 확장</h3>
              <span className={`${s.flag} ${s.idea}`}>아이디어</span>
              <p className={s.p}>
                한국 술을 영어 · 일본어로 설명하는 방향. 관광객과 수출 시장은 경쟁 서비스가 거의 없는 영역입니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 10 */}
      <section className={s.section}>
        <div className={s.num}>10</div>
        <div className={s.body}>
          <h2 className={s.h2}>알려진 제약</h2>
          <p className={s.sub}>미리 알고 계셔야 할 사항과 대응 방향입니다.</p>
          <div className={s.scroll}>
            <table className={s.table}>
              <thead><tr><th>항목</th><th>내용</th><th>대응</th></tr></thead>
              <tbody>
                <tr><td>분석 시간</td><td className={s.was}>약 30초 소요</td><td className={s.now}>결과 캐싱으로 즉시 응답</td></tr>
                <tr><td>카메라</td><td className={s.was}>HTTPS에서만 동작</td><td className={s.now}>배포 시 자동 해결</td></tr>
                <tr><td>마이너한 술</td><td className={s.was}>정보가 부실할 수 있음</td><td className={s.now}>신뢰도 배지로 정직하게 표시</td></tr>
                <tr><td>온라인 주류 판매</td><td className={s.was}>국내법상 일반 주류는 배송 불가</td><td className={s.now}>매장 픽업 방식으로 연결, 전통주만 직배송</td></tr>
                <tr><td>가격 정보</td><td className={s.was}>판매처 사정에 따라 변동</td><td className={s.now}>실시간 조회로 최신값 유지</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 11 */}
      <section className={s.section}>
        <div className={s.num}>11</div>
        <div className={s.body}>
          <h2 className={s.h2}>자주 묻는 질문</h2>
          <dl className={s.faq}>
            <div className={s.qa}>
              <dt>술 정보를 미리 입력해둬야 하나요?</dt>
              <dd>아니요. AI가 라벨을 직접 읽고, 가격은 네이버쇼핑에서 실시간으로 가져옵니다. 등록 작업이 전혀 없습니다.</dd>
            </div>
            <div className={s.qa}>
              <dt>AI가 틀린 정보를 말하면 어떻게 하나요?</dt>
              <dd>
                모르는 것을 지어내지 않도록 설계했고, 확신 정도를 신뢰도 배지로 표시합니다. 가격처럼 자주 바뀌는 정보는
                실제 판매 데이터로 확인합니다.
              </dd>
            </div>
            <div className={s.qa}>
              <dt>웹 검색은 왜 꺼져 있나요?</dt>
              <dd>
                비용이 7배(45원 → 316원), 시간이 6배(30초 → 3분)로 늘어나는 데 비해, 얻는 정보가 네이버쇼핑 조회와
                상당 부분 겹치기 때문입니다. 예기치 않은 비용을 막기 위해 화면과 서버 양쪽에서 막아 두었으며,
                마이너한 술까지 깊게 다뤄야 할 때 설정값 하나로 되살릴 수 있습니다.
              </dd>
            </div>
            <div className={s.qa}>
              <dt>사진 없이 술 이름만으로도 되나요?</dt>
              <dd>됩니다. 결과 화면의 유사주 추천에서 이름을 누르면 사진 없이 바로 분석합니다.</dd>
            </div>
            <div className={s.qa}>
              <dt>기록은 어디에 저장되나요?</dt>
              <dd>
                MongoDB에 저장되어 기기를 바꿔도 유지됩니다. 현재는 사용자 구분이 없어 공용이며, 로그인 도입 후 개인별로
                분리됩니다.
              </dd>
            </div>
          </dl>

          <div className={s.footer}>
            <span>Bottle Lens — 기능 설명서</span>
            <span>2026. 07. 27.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
