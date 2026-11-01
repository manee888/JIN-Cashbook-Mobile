# JIN Cashbook Mobile V2.4 – Fixed Offline

รุ่นนี้แก้ปัญหาปุ่มไม่ตอบสนองและบันทึกรายการไม่ได้ใน V2.3

## สิ่งที่แก้
- แก้ JavaScript error ที่อ้างถึง element เก่าซึ่งไม่มีอยู่ในหน้า HTML
- ปุ่มเพิ่มรายการ / รายรับ / รายจ่าย / บันทึก / แก้ไข / ลบ ทำงานจริง
- IndexedDB เป็นฐานข้อมูลหลัก และมี localStorage fallback สำหรับ WebView ที่จำกัด
- Service Worker cache รุ่นใหม่สำหรับ Offline-first
- Backup JSON ใช้ Web Share บนมือถือเมื่อรองรับ และ fallback เป็นดาวน์โหลดไฟล์
- Restore JSON / CSV / Print ยังคงใช้งานได้
- หน้าตา UI Master สีสันเดิมไม่เปลี่ยนแนว

## GitHub Pages
ทับไฟล์ทั้งหมดใน repository `JIN-Cashbook-Mobile` แล้ว Commit changes

จากนั้นเปิด:
`https://manee888.github.io/JIN-Cashbook-Mobile/`

ครั้งแรกต้องเปิดด้วย Safari (iPhone/iPad) หรือ Chrome (Android/Samsung) และให้หน้าเว็บโหลดจนเสร็จอย่างน้อย 1 ครั้ง เพื่อให้ Service Worker เก็บไฟล์ไว้สำหรับ Offline

> ถ้าเปิดผ่าน LINE แล้วปุ่มไม่ทำงาน ให้เลือก “เปิดใน Safari/Chrome” ก่อน เพราะเบราว์เซอร์ภายในของแอปแชตอาจจำกัด Service Worker และการติดตั้ง PWA
