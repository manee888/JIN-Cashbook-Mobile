# JIN Cashbook Mobile V2

โปรแกรมบัญชีรายรับ-รายจ่ายสำหรับมือถือ แบบ Offline-first / PWA

## จุดเด่น
- ข้อมูลเก็บในเครื่องด้วย IndexedDB
- ใช้งานออฟไลน์หลังติดตั้ง PWA
- รายรับ / รายจ่าย / คงเหลือ
- วันนี้ / เดือนนี้ / ปีนี้ / ทั้งหมด / กำหนดช่วง
- ค้นหา แก้ไข ลบรายการ
- สำรอง/กู้คืน JSON
- ส่งออก CSV
- พิมพ์ / PDF
- รองรับ Android, Samsung, iPhone และ iPad
- รูปแบบ Backup เดียวกับ JIN Cashbook V3: `JIN_CASHBOOK`, `version: 1`

## GitHub Pages
1. สร้าง Repository ชื่อ `jin-cashbook-mobile`
2. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ไว้ที่ root ของ repository
3. Settings → Pages
4. Source: Deploy from a branch
5. Branch: `main` และ Folder: `/ (root)`
6. รอ GitHub Pages สร้างเว็บไซต์ แล้วเปิด URL ที่ GitHub แสดง

## สำคัญ
อย่าลบหรือเปลี่ยน `sw.js`, `manifest.json` และ `icon.svg` หากต้องการให้ติดตั้งเป็นแอปบนมือถือได้
