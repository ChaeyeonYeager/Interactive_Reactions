// ml5 손 제스처 기반 화상 미팅 인터랙션

let handPose; // handpose 모델 객체
let video; // 웹캠 비디오 객체
let hands = []; // 탐지된 손 데이터 저장 배열
let indexFingerTrail = []; // 그리기 경로 저장 배열
let isDrawing = false; // 현재 그리기 모드 여부
let videoOriginalWidth = 640; // 비디오 원본 너비 (좌우 판단 기준)

let currentBrush = 'pen'; // 현재 브러시 종류: 'pen' 또는 'highlighter'

let showHi = false; // 인사 텍스트 표시 여부
let hiStartTime = 0; // 인사 시작 시간

let showAgree = false; // 동의 텍스트 표시 여부
let agreeStartTime = 0; // 동의 제스처 감지 시간

let showMic = false; // 마이크 요청 텍스트 표시 여부
let micStartTime = 0;

let showNext = false; // 다음 발표자 텍스트 표시 여부
let nextStartTime = 0;

let isMuted = true; // 현재 음소거 상태
let showRaiseHandText = false; // 발표 요청 텍스트 표시 여부
let raiseHandStartTime = 0;

let lastActionTime = 0; // 마지막 액션 수행 시간
const cooldown = 1000; // 액션 간 최소 시간 (1초)

let showEmoji = ""; // 표시할 이모지
let emojiStartTime = 0; // 이모지 표시 시작 시간

// 각 버튼 위치 및 크기 설정
const thumbUpX = 590;
const thumbUpY = 200;
const thumbDownX = 590;
const thumbDownY = 300;
const emojiBtnSize = 40;

const muteBtnX = 590;
const muteBtnY = 30;
const muteBtnSize = 40;

const raiseBtnX = 590;
const raiseBtnY = 400;
const raiseBtnSize = 40;



// ml5의 handPose 모델을 미리 로드하는 함수
function preload() {
  handPose = ml5.handPose(); // ml5.js의 손 인식 모델(handPose)을 생성하여 변수에 저장
}


// 초기 설정 함수 (한 번만 실행됨)
function setup() {
  createCanvas(640, 480); // 640x480 크기의 캔버스를 생성하여 화면에 표시
  video = createCapture(VIDEO, { flipped: true }); // 웹캠 비디오를 캡처하고 좌우 반전(flipped) 설정 (거울처럼 보이게)
  video.size(640, 480); // 비디오 사이즈를 캔버스와 동일하게 설정
  video.hide(); // 비디오 엘리먼트를 직접 표시하지 않고, draw()에서 수동으로 렌더링하기 위해 숨김 처리
  handPose.detectStart(video, gotHands); // handPose 모델을 이용해 비디오에서 손 인식을 시작하고, 결과를 gotHands 콜백 함수로 전달
  background(255); // 캔버스 배경을 흰색(255)으로 설정
}


function draw() {
  image(video, 0, 0, width, height); // 비디오 화면을 캔버스에 출력

  // 🎛 버튼 UI 표시
  textSize(32); // 텍스트 크기 설정
  textAlign(CENTER, CENTER); // 텍스트 중앙 정렬
  text(isMuted ? "🔇" : "🔈", muteBtnX, muteBtnY); // 음소거 상태에 따라 아이콘 표시
  text("🙋", raiseBtnX, raiseBtnY); // 발표 요청 버튼
  text("👍", thumbUpX, thumbUpY); // 좋아요 버튼
  text("👎", thumbDownX, thumbDownY); // 싫어요 버튼

  let leftHand = null;  // 왼손 객체 초기화
  let rightHand = null; // 오른손 객체 초기화

  // 손 데이터에서 왼손/오른손 분류 (손목 기준 좌우로 판단)
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i]; // 현재 손
    let wrist = hand.keypoints.find(k => k.name === 'wrist'); // 손목 좌표 찾기
    if (!wrist) continue; // 손목 없으면 건너뜀
    if (wrist.x > videoOriginalWidth / 2) {
      leftHand = hand; // 손목이 오른쪽 → 왼손
    } else {
      rightHand = hand; // 손목이 왼쪽 → 오른손
    }
  }

  const now = millis(); // 현재 시간(ms)
  const leftCount = leftHand ? countExtendedFingers(leftHand) : null; // 왼손 펼친 손가락 수
  const rightCount = rightHand ? countExtendedFingers(rightHand) : null; // 오른손 펼친 손가락 수

  // 🧼 양손 모두 주먹 → 그리기 모드 OFF
  if (
    leftHand && rightHand &&
    countExtendedFingers(leftHand) <= 1 &&
    countExtendedFingers(rightHand) <= 1 &&
    now - lastActionTime > cooldown
  ) {
    isDrawing = false; // 그리기 비활성화
    indexFingerTrail = []; // 그리기 경로 초기화
    lastActionTime = now; // 마지막 액션 시간 갱신
    console.log("🧼 Drawing mode OFF (both fists)"); // 디버그 로그 출력
  }

  // ✍ 왼손 펴고 오른손 접은 상태 → 그리기 모드 ON
  if (
    leftCount !== null &&
    leftCount >= 5 &&
    (rightCount === null || rightCount < 4) &&
    !isDrawing &&
    now - lastActionTime > cooldown
  ) {
    isDrawing = true; // 그리기 모드 활성화
    lastActionTime = now;
    console.log("🎨 Drawing mode ON"); // 디버그 로그
  }

  // ✍ 그리기 상태일 경우 그림 처리
  if (isDrawing) {
    // 왼손이 V 제스처면 형광펜, 아니면 일반 펜 선택
    if (leftHand && checkVGesture(leftHand)) {
      currentBrush = 'highlighter'; // 형광펜
    } else {
      currentBrush = 'pen'; // 일반 펜
    }

    // 오른손 인덱스 손끝 좌표로 경로 저장
    if (rightHand) {
      let indexTip = rightHand.keypoints.find(k => k.name === 'index_finger_tip');
      if (indexTip) {
        let x = 640 - indexTip.x; // 좌우 반전
        let y = indexTip.y;
        indexFingerTrail.push({ x, y, brush: currentBrush }); // 위치 + 브러시 종류 저장

        if (indexFingerTrail.length > 3000) {
          indexFingerTrail.shift(); // 경로 길이 제한
        }
      }
    }

    drawTrail(); // 저장된 경로를 따라 그림 그리기
  }

  // 💬 반응 제스처 인식 (그리기 모드가 아닐 때만)
  if (!isDrawing && now - lastActionTime > cooldown) {
    // ✌️ 양손 V 제스처 → "동의합니다!"
    if (
      leftHand && rightHand &&
      checkVGesture(leftHand) &&
      checkVGesture(rightHand) &&
      !showAgree
    ) {
      showAgree = true; // "동의" 메시지 표시 시작
      agreeStartTime = now;
      lastActionTime = now;
    }

    // 👌 양손 OK 제스처 → 마이크 요청
    if (
      leftHand && rightHand &&
      checkOKGesture(leftHand) &&
      checkOKGesture(rightHand) &&
      !showMic
    ) {
      showMic = true; // 마이크 요청 메시지 표시
      micStartTime = now;
      lastActionTime = now;
    }

    // ☝️ 양손 포인팅 → 다음 발표자
    if (
      leftHand && rightHand &&
      checkPointGesture(leftHand) &&
      checkPointGesture(rightHand) &&
      !showNext
    ) {
      showNext = true; // 다음 발표자 메시지 표시
      nextStartTime = now;
      lastActionTime = now;
    }
  }

  // 🖱️ 버튼 클릭 감지 (오른손 검지 손끝 기준)
  let tip = rightHand?.keypoints.find(k => k.name === "index_finger_tip");
  if (!isDrawing && tip && now - lastActionTime > cooldown) {
    let tipX = 640 - tip.x; // 좌우 반전
    let tipY = tip.y;

    // 🔈 음소거 버튼 클릭
    if (isFingerInButton(tipX, tipY, muteBtnX, muteBtnY, muteBtnSize)) {
      isMuted = !isMuted; // 음소거 상태 토글
      lastActionTime = now;
    }

    // 🙋 발표 요청 버튼 클릭
    if (isFingerInButton(tipX, tipY, raiseBtnX, raiseBtnY, raiseBtnSize)) {
      showRaiseHandText = true; // 발표 요청 메시지 표시
      raiseHandStartTime = now;
      lastActionTime = now;
    }

    // 👍 이모지 버튼 클릭
    if (isFingerInButton(tipX, tipY, thumbUpX, thumbUpY, emojiBtnSize)) {
      showEmoji = "👍"; // 이모지 표시
      emojiStartTime = now;
      lastActionTime = now;
    }

    // 👎 이모지 버튼 클릭
    if (isFingerInButton(tipX, tipY, thumbDownX, thumbDownY, emojiBtnSize)) {
      showEmoji = "👎";
      emojiStartTime = now;
      lastActionTime = now;
    }
  }

  // 💬 반응 메시지들 화면 출력 (각각 2초 유지)
  if (showAgree && now - agreeStartTime <= 2000) {
    textSize(32);
    fill(0);
    text("동의합니다! 👍", width / 2, height / 2 - 100);
  } else {
    showAgree = false;
  }

  if (showMic && now - micStartTime <= 2000) {
    textSize(32);
    fill(0);
    text("마이크를 켜주시겠어요?", width / 2, height / 2 - 50);
  } else {
    showMic = false;
  }

  if (showNext && now - nextStartTime <= 2000) {
    textSize(32);
    fill(0);
    text("다음 발표자 준비해주세요!", width / 2, height / 2 + 10);
  } else {
    showNext = false;
  }

  if (showRaiseHandText && now - raiseHandStartTime <= 2000) {
    textSize(36);
    fill(0);
    text("제가 발표하고 싶습니다!", width / 2, height / 2 + 80);
  } else {
    showRaiseHandText = false;
  }

  if (showEmoji && now - emojiStartTime <= 2000) {
    textSize(100);
    text(showEmoji, width / 2, height / 2); // 화면 가운데에 이모지 출력
  } else {
    showEmoji = "";
  }

  // 🔘 그리기 모드 상태 표시 (좌측 상단)
  noStroke();
  fill(isDrawing ? color(0, 255, 0) : color(200)); // ON이면 초록색, OFF면 회색

  textSize(24);
  textAlign(CENTER, CENTER);
  text(isDrawing ? "🖌️" : " ", 30, 30); // 브러시 아이콘 표시
}



function drawTrail() {
  // 저장된 손가락 경로가 2개 미만이면 그릴 게 없으므로 종료
  if (indexFingerTrail.length < 2) return;

  // 손가락 경로 배열을 순회하며 선 그리기
  for (let i = 1; i < indexFingerTrail.length; i++) {
    const prev = indexFingerTrail[i - 1]; // 이전 지점
    const curr = indexFingerTrail[i];     // 현재 지점

    // 동일한 브러시 종류일 때만 선을 그림 (도중에 브러시 변경될 수 있음)
    if (prev.brush === curr.brush) {
      if (curr.brush === 'pen') {
        stroke(0, 0, 0, 200);     // 검정색 펜, 반투명 정도는 200
        strokeWeight(3);         // 선 굵기 3
      } else if (curr.brush === 'highlighter') {
        stroke(255, 255, 0, 80); // 노란색 형광펜, 투명도 80
        strokeWeight(15);        // 두꺼운 선 (형광펜 느낌)
      }
      // 이전 점과 현재 점을 선으로 연결
      line(prev.x, prev.y, curr.x, curr.y);
    }
  }
}


// 🔍 손끝이 버튼 범위에 닿았는지 체크
function isFingerInButton(x, y, btnX, btnY, size) {
  return dist(x, y, btnX, btnY) < size / 2;
}



function checkVGesture(hand) {
  // 각 손가락의 끝과 기준 관절 위치를 keypoints 배열에서 가져옴
  let index = hand.keypoints[8];        // 검지 손끝
  let indexBase = hand.keypoints[6];    // 검지 기준 관절
  let middle = hand.keypoints[12];      // 중지 손끝
  let middleBase = hand.keypoints[10];  // 중지 기준 관절
  let ring = hand.keypoints[16];        // 약지 손끝
  let ringBase = hand.keypoints[14];    // 약지 기준 관절
  let pinky = hand.keypoints[20];       // 새끼 손가락 손끝
  let pinkyBase = hand.keypoints[18];   // 새끼 기준 관절

  // 검지가 펴졌는지 판단 (손끝이 기준 관절보다 위에 있음)
  let indexUp = index && indexBase && index.y < indexBase.y;

  // 중지가 펴졌는지 판단
  let middleUp = middle && middleBase && middle.y < middleBase.y;

  // 약지가 접혀 있는지 판단 (손끝이 기준 관절보다 아래에 있음)
  let ringUp = ring && ringBase && ring.y < ringBase.y;

  // 새끼 손가락이 접혀 있는지 판단
  let pinkyUp = pinky && pinkyBase && pinky.y < pinkyBase.y;

  // 검지와 중지는 펴고, 나머지는 접은 상태일 때 V 제스처로 판단
  return indexUp && middleUp && !ringUp && !pinkyUp;
}


function checkOKGesture(hand) {
  // 손의 주요 손가락 끝 위치들을 가져옴
  const thumbTip = hand.keypoints[4];   // 엄지 손끝
  const indexTip = hand.keypoints[8];   // 검지 손끝
  const middle = hand.keypoints[12];    // 중지 손끝
  const ring = hand.keypoints[16];      // 약지 손끝
  const pinky = hand.keypoints[20];     // 새끼 손끝

  // 필요한 손가락이 모두 감지되지 않았을 경우 false 반환
  if (!thumbTip || !indexTip || !middle || !ring || !pinky) return false;

  // 엄지와 검지가 서로 가까이 맞닿았는지 여부 판단 (거리 < 30px)
  const isThumbTouchIndex =
    dist(thumbTip.x, thumbTip.y, indexTip.x, indexTip.y) < 30;

  // 나머지 손가락들(중지, 약지, 새끼)이 펴져 있는지 확인
  const isOtherFingersExtended =
    middle.y < hand.keypoints[10].y &&  // 중지가 기준 관절보다 위에 있는지
    ring.y < hand.keypoints[14].y &&    // 약지도 기준 관절보다 위에 있는지
    pinky.y < hand.keypoints[18].y;     // 새끼도 기준 관절보다 위에 있는지

  // 엄지와 검지가 닿고, 나머지 손가락이 모두 펴졌다면 OK 제스처로 판단
  return isThumbTouchIndex && isOtherFingersExtended;
}



function checkPointGesture(hand) {
  // 각 손가락의 손끝과 기준 관절(keypoint)을 가져옴
  let index = hand.keypoints[8];        // 검지 손끝
  let indexBase = hand.keypoints[6];    // 검지 기준 관절
  let middle = hand.keypoints[12];      // 중지 손끝
  let middleBase = hand.keypoints[10];  // 중지 기준 관절
  let ring = hand.keypoints[16];        // 약지 손끝
  let ringBase = hand.keypoints[14];    // 약지 기준 관절
  let pinky = hand.keypoints[20];       // 새끼 손가락 손끝
  let pinkyBase = hand.keypoints[18];   // 새끼 기준 관절

  // 모든 손가락의 keypoint가 존재하는지 확인 (감지되지 않으면 false 반환)
  if (!(index && indexBase && middle && middleBase && ring && ringBase && pinky && pinkyBase)) {
    return false;
  }

  // 검지가 펴져 있는지 확인 (손끝이 관절보다 위)
  let indexUp = index.y < indexBase.y;

  // 중지, 약지, 새끼는 모두 접혀 있는지 확인 (손끝이 관절보다 아래)
  let middleFolded = middle.y > middleBase.y;
  let ringFolded = ring.y > ringBase.y;
  let pinkyFolded = pinky.y > pinkyBase.y;

  // 검지만 펴고 나머지는 접힌 상태면 포인팅 제스처로 판단
  return indexUp && middleFolded && ringFolded && pinkyFolded;
}



function getExtendedFingers(hand) {
  let extended = []; // 펴진 손가락들의 번호를 저장할 배열

  // 검지(index finger, 번호 8)가 펴졌는지 확인
  if (hand.keypoints[8] && hand.keypoints[6] && hand.keypoints[8].y < hand.keypoints[6].y)
    extended.push(8); // 손끝이 관절보다 위에 있으면 펴진 것으로 간주

  // 중지(middle finger, 번호 12)가 펴졌는지 확인
  if (hand.keypoints[12] && hand.keypoints[10] && hand.keypoints[12].y < hand.keypoints[10].y)
    extended.push(12);

  // 약지(ring finger, 번호 16)가 펴졌는지 확인
  if (hand.keypoints[16] && hand.keypoints[14] && hand.keypoints[16].y < hand.keypoints[14].y)
    extended.push(16);

  // 새끼(pinky finger, 번호 20)가 펴졌는지 확인
  if (hand.keypoints[20] && hand.keypoints[18] && hand.keypoints[20].y < hand.keypoints[18].y)
    extended.push(20);

  // 엄지(thumb, 번호 4)는 다른 기준으로 판단 → 손끝과 관절의 x축 거리 차이 사용
  if (hand.keypoints[4] && hand.keypoints[2] && Math.abs(hand.keypoints[4].x - hand.keypoints[2].x) > 20)
    extended.push(4); // 엄지가 펼쳐졌다고 판단 (x축으로 벌어진 경우)

  return extended; // 펴진 손가락 번호 배열 반환
}



function countExtendedFingers(hand) {
  let count = 0; // 펴진 손가락 수를 저장할 변수

  // 🟦 검지(index finger) 손끝이 관절보다 위에 있으면 펴진 것으로 판단
  if (hand.keypoints[8] && hand.keypoints[6] && hand.keypoints[8].y < hand.keypoints[6].y) count++;

  // 🟦 중지(middle finger)
  if (hand.keypoints[12] && hand.keypoints[10] && hand.keypoints[12].y < hand.keypoints[10].y) count++;

  // 🟦 약지(ring finger)
  if (hand.keypoints[16] && hand.keypoints[14] && hand.keypoints[16].y < hand.keypoints[14].y) count++;

  // 🟦 새끼(pinky finger)
  if (hand.keypoints[20] && hand.keypoints[18] && hand.keypoints[20].y < hand.keypoints[18].y) count++;

  // 🟨 엄지(thumb)는 x축 거리 차이로 판단 (벌어졌으면 펼친 것)
  if (hand.keypoints[4] && hand.keypoints[2] && Math.abs(hand.keypoints[4].x - hand.keypoints[2].x) > 20) count++;

  return count; // 펴진 손가락 수 반환
}


function gotHands(results) {
  hands = results; // handpose 모델이 감지한 손 데이터를 전역 변수 hands에 저장
}

