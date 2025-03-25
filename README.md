# ✋ ml5.js 기반 손 제스처 화상 미팅 인터페이스


---

## 📌 개요

이 프로젝트는 [ml5.js](https://ml5js.org/)의 `handPose` 모델을 사용하여 웹캠으로 손의 위치와 제스처를 인식하고,  
화상 미팅에서 사용할 수 있는 다양한 기능(예: 그림 그리기, 발표 요청, 이모지 반응 등)을 제공합니다.

사용자는 단순히 손 제스처만으로 다음과 같은 작업을 수행할 수 있습니다:

- 🖌️ 화면에 그림 그리기 (펜/형광펜)
- 🙋 발표 요청
- 🔇 음소거/음소거 해제모드 화면에 표시
- 👍/👎 반응 보내기
-  마이크 요청/다음 발표자/동의 메시지 전송

---

## 🔧 기술 스택

- **p5.js**: 그래픽 및 인터페이스 렌더링
- **ml5.js (handPose)**: 실시간 손 관절 인식
- **JavaScript (ES6)**: 전체 로직 처리
- **웹캠**: 사용자의 손 동작을 추적하는 입력 장치

---

## ⚙️ 코드 흐름 설명

### 1. 초기 설정

- `preload()`: ml5의 handPose 모델을 미리 초기화합니다.
- `setup()`:
  - 640x480 크기의 캔버스를 생성하고,
  - 웹캠에서 비디오를 받아와 좌우 반전(flipped) 처리합니다.
  - handPose 모델로 손 추적을 시작하고 결과를 `gotHands()` 콜백으로 넘깁니다.

---

### 2. 메인 루프: `draw()`

`draw()`는 매 프레임마다 다음 작업을 수행합니다:

#### a. 비디오 및 버튼 출력
- 웹캠 이미지를 배경에 출력하고
- 🔈, 🙋, 👍, 👎 버튼을 캔버스 상단/우측에 표시합니다.

#### b. 손 위치 감지 및 분류
- 손이 좌우 어디에 있는지 손목(wrist) 위치로 판단하여 **왼손 / 오른손**으로 분류합니다.

#### c. 제스처에 따른 동작 처리

- **양손 주먹(손가락 ≤ 1개)** → 그리기 모드 종료
- **왼손 펼침(손가락 ≥ 5) + 오른손 접힘(손가락 < 4)** → 그리기 모드 시작

##### 그리기 모드 중:
- 왼손이 ✌️(V 제스처) → 형광펜 브러시
- 그 외 → 일반 펜 브러시
- 오른손 검지 끝 위치를 따라 선을 그림

##### 제스처 감지 (그리기 모드가 아닐 때만):

| 제스처 조건                 | 반응 텍스트                    |
|----------------------------|-------------------------------|
| 양손 ✌️ (V 제스처)        | `"동의합니다! 👍"`            |
| 양손 👌 (OK 제스처)        | `"마이크를 켜주시겠어요?"`    |
| 양손 ☝️ (포인팅 제스처)    | `"다음 발표자 준비해주세요!"` |
| 오른손 검지로 버튼 클릭     | 버튼별 이모지/기능 실행        |

---

### 3. 그리기 기능

- `indexFingerTrail` 배열에 손가락 경로를 저장하여, 이전 위치와 현재 위치를 연결해 선을 그림
- **왼손이 ✌️(V 제스처)이면 형광펜**, 그 외는 일반 펜 사용
- 일정 길이(3000점) 이상이면 오래된 경로를 제거함

---

## ✋ 제스처 커맨드 요약

| 제스처 유형        | 조건 설명                                          | 작동 결과 / 반응                           |
|--------------------|---------------------------------------------------|--------------------------------------------|
| 🖌️ 그리기 ON       | 왼손 손가락 ≥ 5개 펴짐 + 오른손은 접힘             | 그림 그리기 시작                           |
| ✏️ 일반 펜 모드     | 그리기 중 & 왼손 일반 상태                         | 검은색 펜으로 그림                         |
| ✍️ 형광펜 모드      | 그리기 중 & 왼손이 ✌️(V 제스처)                    | 형광펜(노란색) 브러시로 그림               |
| 🧼 그리기 OFF      | 양손 손가락 ≤ 1개 (주먹 상태)                     | 그림 그리기 중단                           |
| ✌️ 동의            | 양손 모두 V 제스처 (검지+중지만 펴짐)             | `"동의합니다! 👍"` 텍스트 출력             |
| 👌 마이크 요청     | 양손 OK 제스처 (엄지+검지 접촉, 나머지는 펴짐)     | `"마이크를 켜주시겠어요?"` 텍스트 출력     |
| ☝️ 다음 발표자     | 양손 포인팅 (검지만 펴짐)                         | `"다음 발표자 준비해주세요!"` 텍스트 출력 |
| 🙋 발표 요청       | 오른손으로 🙋 버튼 클릭                            | `"제가 발표하고 싶습니다!"` 출력           |
| 🔇 음소거 토글     | 오른손으로 🔈 버튼 클릭                            | 음소거 / 해제 상태 전환                    |
| 👍 / 👎             | 오른손으로 해당 이모지 버튼 클릭                   | 2초 동안 해당 이모지 출력                 |

---

## ✍️ 제스처 구현 방식

### 1. 손가락 펼침 감지

- `getExtendedFingers()` 또는 `countExtendedFingers()` 함수를 통해 각 손가락의 관절 위치(y 좌표 또는 x 거리)를 비교하여  
  손가락이 펴졌는지/접혔는지 판단합니다.

### 2. 특정 제스처 판별

- **V 제스처**: 검지+중지 펴짐 && 약지+새끼 접힘
- **OK 제스처**: 엄지와 검지가 가까우면서 나머지 손가락은 펴짐
- **포인팅**: 검지만 펴짐, 나머지는 접힘


