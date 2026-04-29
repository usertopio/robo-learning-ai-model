"""
robot_stream_test.py
--------------------
สคริปต์ทดสอบการส่งสัญญาณภาพจากกล้อง (Webcam/Raspberry Pi)
ไปยัง Ai Teachstack Server ผ่านเครือข่าย LAN

วิธีใช้งาน:
    1. ติดตั้ง dependencies:
       pip install opencv-python python-socketio websocket-client

    2. แก้ค่า SERVER_URL ให้ตรงกับ IP ของเครื่อง Server ในวง LAN
       (หาด้วยคำสั่ง ipconfig บน Windows หรือ ip addr บน Linux)

    3. แก้ค่า ROBOT_ID ให้ตรงกับที่จะกรอกบนหน้าเว็บ

    4. รันสคริปต์:
       python robot_stream_test.py

    5. เปิดหน้าเว็บ, ลาก Block "Robot Camera Stream" ลงบน Workspace
       กรอก Robot ID แล้วกด "Connect to Robot"
"""

import cv2
import base64
import socketio
import time
import sys

# แก้ปัญหา UnicodeEncodeError บน Windows (terminal ภาษาไทย)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# =============================================
# CONFIG — แก้ไขตรงนี้ตามการตั้งค่าของคุณ
# =============================================

# IP ของเครื่องที่รัน Backend Server
# ถ้าทดสอบบนเครื่องเดียวกัน ใช้ localhost
SERVER_URL = 'http://localhost:3000'

# *** ถ้า Robot อยู่เครื่องอื่นใน WiFi LAN เดียวกัน เปลี่ยนเป็น: ***
# SERVER_URL = 'http://192.168.1.40:3000'
# (IP 192.168.1.40 คือ IP จริงของเครื่อง Server ที่รัน Backend อยู่)

# ชื่อ/รหัสหุ่นยนต์ — ต้องตรงกับที่กรอกบนหน้าเว็บ
ROBOT_ID = 'ROBOT_01'

# ความละเอียดกล้อง
FRAME_WIDTH = 640
FRAME_HEIGHT = 480

# Quality ของ JPEG (0-100) ยิ่งต่ำยิ่งเร็วแต่ภาพหยาบ
JPEG_QUALITY = 70

# ดีเลย์ระหว่าง Frame ในวินาที (0.033 ≈ 30 FPS)
FRAME_DELAY = 0.033

# กล้องที่ใช้ (0 = กล้องแรก, 1 = กล้องที่สอง)
CAMERA_INDEX = 0

# =============================================


def main():
    print(f"🤖 Robo Learn AI - Robot Stream Tester")
    print(f"   Server  : {SERVER_URL}")
    print(f"   Robot ID: {ROBOT_ID}")
    print(f"   Camera  : Index {CAMERA_INDEX}")
    print(f"   FPS     : ~{int(1 / FRAME_DELAY)}")
    print("-" * 45)

    # เชื่อมต่อ Socket.IO
    sio = socketio.Client()
    connected = False

    @sio.event
    def connect():
        nonlocal connected
        connected = True
        print(f"[✅] เชื่อมต่อกับ Server สำเร็จ!")
        # ส่งสัญญาณบอกว่า Robot นี้ Online แล้ว
        sio.emit('robot_ping', {'robotId': ROBOT_ID})
        print(f"[📡] ส่งสัญญาณ Robot ID: {ROBOT_ID}")

    @sio.event
    def disconnect():
        nonlocal connected
        connected = False
        print("[⚠️] หลุดการเชื่อมต่อ")

    @sio.event
    def connect_error(data):
        print(f"[❌] เชื่อมต่อล้มเหลว: {data}")

    print(f"[🔌] กำลังเชื่อมต่อ {SERVER_URL}...")
    try:
        sio.connect(SERVER_URL, transports=['websocket'])
    except Exception as e:
        print(f"[❌] ไม่สามารถเชื่อมต่อได้: {e}")
        print("\n💡 แนะนำ: ตรวจสอบว่า Backend Server กำลังรันอยู่ที่ SERVER_URL ที่ระบุ")
        sys.exit(1)

    # เปิดกล้อง
    print(f"\n[📷] กำลังเปิดกล้อง Index {CAMERA_INDEX}...")
    cap = cv2.VideoCapture(CAMERA_INDEX)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)

    if not cap.isOpened():
        print(f"[❌] ไม่สามารถเปิดกล้อง Index {CAMERA_INDEX} ได้")
        sio.disconnect()
        sys.exit(1)

    print(f"[OK] Camera opened successfully")
    print(f"[>>] Streaming to Robot ID: '{ROBOT_ID}' | Press 'q' to stop\n")


    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("[⚠️] อ่านภาพจากกล้องไม่ได้")
                break

            # บีบอัดเป็น JPEG แล้วแปลงเป็น Base64
            encode_params = [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY]
            _, buffer = cv2.imencode('.jpg', frame, encode_params)
            jpg_as_text = base64.b64encode(buffer).decode('utf-8')
            image_data = f"data:image/jpeg;base64,{jpg_as_text}"

            # ส่งไปยัง Server พร้อมแนบ Robot ID
            if connected:
                sio.emit('video_frame_from_robot', {
                    'robotId': ROBOT_ID,
                    'image': image_data
                })

            # แสดง Preview บนหน้าจอ (กด q เพื่อออก)
            status_color = (0, 255, 0) if connected else (0, 0, 255)
            cv2.putText(frame, f"Robot ID: {ROBOT_ID}", (10, 25),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 100), 2)
            cv2.circle(frame, (FRAME_WIDTH - 20, 20), 10, status_color, -1)

            cv2.imshow(f'Robot Camera Preview ({ROBOT_ID})', frame)

            if cv2.waitKey(1) & 0xFF == ord('q'):
                print("[STOP] User pressed q")
                break

            time.sleep(FRAME_DELAY)

    except KeyboardInterrupt:
        print("\n[STOP] Ctrl+C")
    finally:
        print("[..] Disconnecting...")
        cap.release()
        cv2.destroyAllWindows()
        sio.disconnect()
        print("[OK] Done")


if __name__ == '__main__':
    main()
