const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer');
const xlsx = require('xlsx');

// ตั้งค่าที่เก็บไฟล์ชั่วคราว
const upload = multer({ dest: 'uploads/' });
const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'schedule_db',
    password: '1234',
    port: 5432,
});

pool.connect()
    .then(() => console.log('✅ เชื่อมต่อฐานข้อมูล PostgreSQL สำเร็จ!'))
    .catch(err => console.error('❌ เกิดข้อผิดพลาด', err.stack));
// ==========================================
// Helper Function: คัดกรองและรวมกลุ่มเรียนที่ซ้ำซ้อน
// ==========================================
const mergeAndCleanGroups = (groupsArray) => {
    // 1. ถ้าไม่มีข้อมูล ให้ส่งค่าว่างกลับไป
    if (!groupsArray || groupsArray.length === 0) return '';
    
    // 2. กรองเอาเฉพาะข้อมูลที่มีค่าจริงๆ (ลบค่า null/undefined ทิ้ง)
    let validGroups = groupsArray.filter(Boolean);
    
    // 3. เรียงลำดับจากข้อความที่ "ยาวที่สุด" ไปหา "สั้นที่สุด"
    validGroups.sort((a, b) => b.length - a.length);
    
    const keptGroups = [];
    
    validGroups.forEach(g => {
        // ลบช่องว่างออกเพื่อการเปรียบเทียบที่แม่นยำ
        const cleanG = g.replace(/\s+/g, ''); 
        
        // 4. ตรวจสอบว่า ชื่อกลุ่มนี้ ถูกครอบคลุมอยู่ในชื่อกลุ่มยาวๆ ที่เราเก็บไว้แล้วหรือยัง?
        const isDuplicate = keptGroups.some(kept => kept.replace(/\s+/g, '').includes(cleanG));
        
        // 5. ถ้ายังไม่มี (ไม่ซ้ำ) ให้เก็บเข้ากล่อง
        if (!isDuplicate) {
            keptGroups.push(g);
        }
    });
    
    // 6. เรียงลำดับตัวอักษรให้สวยงาม แล้วจับมัดรวมกันด้วย ' | '
    return keptGroups.sort().join(' | ');
};

// ==========================================
// API: นำเข้าข้อมูล (เวอร์ชันแก้ปัญหาการจับคู่กลุ่มเรียนไม่ตรง)
// ==========================================
app.post('/api/import-excel', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'กรุณาอัปโหลดไฟล์ Excel' });

    try {
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0]; 
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]); 

        let updateCount = 0;
        let failCount = 0;

        console.log('--- เริ่มวิเคราะห์ไฟล์ Excel ---');

        for (const row of data) {
            const subjectCode = row['รหัสวิชา']?.toString().trim();
            const studentGroup = row['กลุ่มเรียน']?.toString().trim();
            const teacherName = row['อาจารย์ผู้สอน']?.toString().trim();
            
            if (!subjectCode || !teacherName) continue;

            // 🌟 แก้ไข: อัปเดตข้อมูลตาราง main_classes ผ่านการเชื่อม class_student_groups
            const updateQuery = `
                UPDATE main_classes 
                SET teacher_name = $1 
                FROM class_student_groups 
                WHERE main_classes.id = class_student_groups.class_id 
                AND main_classes.subject_code = $2 
                AND class_student_groups.student_group ILIKE $3
            `;
            
            const values = [teacherName, subjectCode, `${studentGroup}%` || '%'];
            
            const result = await pool.query(updateQuery, values);
            
            if (result.rowCount > 0) {
                updateCount += result.rowCount;
                console.log(`อัปเดตสำเร็จ: ${subjectCode} (${studentGroup}) -> ${teacherName}`);
            } else {
                failCount++;
                console.log(`ค้นหาไม่พบในฐานข้อมูล: วิชา ${subjectCode} กลุ่ม ${studentGroup}`);
            }
        }

        fs.unlinkSync(req.file.path);
        res.json({ success: true, message: `อัปเดตสำเร็จ ${updateCount} รายการ, ไม่พบ ${failCount} รายการ` });

    } catch (error) {
        console.error('Import Error:', error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
    }
});

/**
 * API สำหรับดึงข้อมูลชื่ออาจารย์แบบอัตโนมัติ
 * รองรับการค้นหาแบบยืดหยุ่น (ILIKE) และกรองข้อมูลที่ไม่สมบูรณ์ออก
 */
app.get('/api/get-subject-info', async (req, res) => {
    const { subject_code, student_group } = req.query;

    if (!subject_code || !student_group) {
        return res.json({ success: false, message: 'กรุณาระบุรหัสวิชาและกลุ่มเรียน' });
    }

    try {
        // 🌟 แก้ไข: ค้นหาจาก 2 ตารางใหม่
        const query = `
            SELECT m.teacher_name 
            FROM main_classes m
            JOIN class_student_groups csg ON m.id = csg.class_id
            WHERE m.subject_code = $1 
            AND csg.student_group ILIKE $2 
            AND m.teacher_name IS NOT NULL 
            AND m.teacher_name NOT IN ('', 'ไม่ระบุ', '[null]')
            ORDER BY CASE WHEN m.teacher_name = 'ไม่ระบุ' THEN 2 ELSE 1 END, m.teacher_name ASC
            LIMIT 1
        `;
        
        const values = [
            subject_code.trim(), 
            `%${student_group.trim()}%`
        ];

        const result = await pool.query(query, values);

        if (result.rows.length > 0) {
            res.json({ 
                success: true, 
                teacher_name: result.rows[0].teacher_name 
            });
        } else {
            res.json({ 
                success: false, 
                message: 'ไม่พบชื่ออาจารย์ในระบบ (กรุณาอัปโหลดตารางสอน)' 
            });
        }
    } catch (error) {
        console.error('Database Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล' });
    }
});

// ==========================================
// API: ตรวจสอบการชนกันของตาราง (อัปเกรดแก้ Error + ค้นหา)
// ==========================================
app.post('/api/check-schedule', async (req, res) => {
    const { teacher_name, student_group, year_level, class_date, start_time, end_time } = req.body;

    try {
        const daysMap = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        const dayOfWeek = daysMap[new Date(class_date).getDay()];

        let cleanTeacher = teacher_name ? teacher_name.replace(/อาจารย์|อ\.|ผศ\.|รศ\.|ศ\.|ดร\./g, '').trim().split(' ')[0] : '';
        if (!cleanTeacher) cleanTeacher = 'NOT_FOUND';

        const cleanYearMatch = year_level ? year_level.match(/ปี\s*\d/) : null;
        let cleanYear = cleanYearMatch ? cleanYearMatch[0] : '';
        if (!cleanYear) cleanYear = 'NOT_FOUND';

        const safeGroup = student_group ? student_group.trim() : 'NOT_FOUND';

        // --- ส่วนที่ 1: ตรวจสอบตารางเรียนปกติ ---
        // 🌟 แก้ไข: ใช้ 2 ตารางเชื่อมกัน
        const regQuery = `
            SELECT m.* FROM main_classes m
            LEFT JOIN class_student_groups csg ON m.id = csg.class_id
            WHERE m.day_of_week = $1 
            AND (
                m.teacher_name ILIKE $2 
                OR csg.student_group ILIKE $3 
                OR csg.student_group ILIKE $4
            )
            AND m.start_time < $6 AND m.end_time > $5
            LIMIT 1
        `;
        const regValues = [
            dayOfWeek, 
            `%${cleanTeacher}%`, 
            `%${cleanYear}%`,
            `%${safeGroup}%`, 
            start_time, 
            end_time
        ];
        const regResult = await pool.query(regQuery, regValues);

        if (regResult.rows.length > 0) {
            const conflict = regResult.rows[0];
            const isTeacherConflict = conflict.teacher_name && conflict.teacher_name.includes(cleanTeacher);
            const who = isTeacherConflict ? `อาจารย์ผู้สอน` : `นักศึกษาชั้น ${year_level}`;
            
            return res.json({
                isConflict: true,
                message: `❌ ไม่สามารถลงได้: ${who} ติดเรียน/สอนวิชา ${conflict.subject_code} เวลา ${conflict.start_time.slice(0,5)} - ${conflict.end_time.slice(0,5)}`
            });
        }

        // --- ส่วนที่ 2: ตรวจสอบตารางสอนชดเชยที่ถูกอนุมัติไปแล้ว ---
        const mkQuery = `
            SELECT * FROM schedules 
            WHERE class_date = $1 
            AND status = 'อนุมัติแล้ว'
            AND (
                teacher_name ILIKE $2 
                OR student_group ILIKE $3 
                OR year_level ILIKE $4
            )
            AND start_time < $6 AND end_time > $5
            LIMIT 1
        `;
        const mkValues = [
            class_date, 
            `%${cleanTeacher}%`, 
            `%${safeGroup}%`, 
            `%${cleanYear}%`, 
            start_time, 
            end_time
        ];
        const mkResult = await pool.query(mkQuery, mkValues);

        if (mkResult.rows.length > 0) {
            const conflict = mkResult.rows[0];
            const isTeacherConflict = conflict.teacher_name && conflict.teacher_name.includes(cleanTeacher);
            const who = isTeacherConflict ? `อาจารย์ผู้สอน` : `นักศึกษาชั้น ${year_level}`;
            
            return res.json({
                isConflict: true,
                message: `ไม่สามารถลงได้: ${who} ติดสอน/เรียนชดเชยวิชา ${conflict.subject_code} เวลา ${conflict.start_time.slice(0,5)} - ${conflict.end_time.slice(0,5)}`
            });
        }

        res.json({ 
            isConflict: false, 
            message: 'เวลาว่างตรงกันทั้งอาจารย์และนักศึกษา สามารถบันทึกคำขอได้ครับ!' 
        });

    } catch (error) {
        console.error('Check Schedule Error:', error);
        res.status(500).json({ isConflict: true, message: 'เกิดข้อผิดพลาดในระบบตรวจสอบตาราง โปรดดู Console แจ้งเตือนหลังบ้าน' });
    }
});

// ==========================================
// API: บันทึกคำขอสอนชดเชย (อัปเกรดระบบตรวจจับการชน 100% ครอบคลุมทุกสาขา)
// ==========================================
app.post('/api/schedules', async (req, res) => {
    const { teacher_name, subject_code, year_level, student_group, room_id, class_date, start_time, end_time, missed_date, reason, subject_name } = req.body;

    try {
        // 🛑 ด่าน 1: เช็คระบบเปิด/ปิด
        const settingQuery = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'allow_booking'");
        const isBookingAllowed = settingQuery.rows.length > 0 && settingQuery.rows[0].setting_value === 'true';

        if (!isBookingAllowed) {
            return res.status(403).json({ success: false, message: 'ระบบปิดรับคำขอสอนชดเชยชั่วคราว' });
        }

        // 🌟 1. แปลงวันที่แบบรัดกุม (ป้องกันปัญหา พ.ศ./ค.ศ. และ Timezone)
        const [y, m, d] = class_date.split('-');
        const realYear = parseInt(y) > 2500 ? parseInt(y) - 543 : parseInt(y); 
        const safeDate = new Date(realYear, parseInt(m) - 1, parseInt(d));
        const dayIndex = safeDate.getDay(); 

        // 🌟 2. เตรียมชื่อวัน "ทุกรูปแบบ" (ครอบคลุมคำย่อที่แต่ละสาขาอาจจะพิมพ์ไม่เหมือนกัน)
        const dayFormats = [
            ['วันอาทิตย์', 'อาทิตย์', 'อา.', 'Sunday', '7', 'Sun'],
            ['วันจันทร์', 'จันทร์', 'จ.', 'Monday', '1', 'Mon'],
            ['วันอังคาร', 'อังคาร', 'อ.', 'Tuesday', '2', 'Tue'],
            ['วันพุธ', 'พุธ', 'พ.', 'Wednesday', '3', 'Wed'],
            ['วันพฤหัสบดี', 'พฤหัสบดี', 'พฤหัส', 'พฤ.', 'Thursday', '4', 'Thu'],
            ['วันศุกร์', 'ศุกร์', 'ศ.', 'Friday', '5', 'Fri'],
            ['วันเสาร์', 'เสาร์', 'ส.', 'Saturday', '6', 'Sat']
        ];
        const possibleDays = dayFormats[dayIndex]; 

        // 🌟 3. ทำความสะอาดข้อความ ป้องกันปัญหาช่องว่างซ่อนเร้น
        const cleanTeacherName = teacher_name ? teacher_name.replace(/\s+/g, '') : '';
        const cleanRoom = room_id ? room_id.trim() : '';
        const cleanGroup = student_group ? student_group.replace(/\s+/g, '') : '';

        // 🛑 ด่าน 2: เช็คตารางเรียนปกติ (ถอด REPLACE ออกจากเวลา เพราะ DB เป็น Type Time อยู่แล้ว)
        const checkMainQuery = `
            SELECT m.id 
            FROM main_classes m
            LEFT JOIN class_student_groups csg ON m.id = csg.class_id
            LEFT JOIN student_groups_master g ON csg.student_group = g.short_name
            WHERE TRIM(m.day_of_week) = ANY($1::text[])
            AND m.start_time < $3::time 
            AND m.end_time > $2::time
            AND (
                ($4 != '' AND REPLACE(m.teacher_name, ' ', '') ILIKE '%' || $4 || '%') OR
                ($5 != '' AND $5 != '-' AND TRIM(m.room_id) ILIKE $5) OR
                ($6 != '' AND (
                    REPLACE(csg.student_group, ' ', '') ILIKE '%' || $6 || '%' OR
                    $6 ILIKE '%' || REPLACE(csg.student_group, ' ', '') || '%' OR
                    REPLACE(g.full_name, ' ', '') ILIKE '%' || $6 || '%' OR
                    $6 ILIKE '%' || REPLACE(g.full_name, ' ', '') || '%'
                ))
            )
            LIMIT 1
        `;
        const mainConflict = await pool.query(checkMainQuery, [possibleDays, start_time, end_time, cleanTeacherName, cleanRoom, cleanGroup]);

        if (mainConflict.rows.length > 0) {
            return res.status(400).json({ success: false, message: '❌ ไม่สามารถจองได้: เวลาที่เลือกชนกับ "ตารางเรียนปกติ" (อาจารย์ ห้อง หรือนักศึกษาไม่ว่าง)' });
        }

        // 🛑 ด่าน 3: เช็คชนกับคำขอสอนชดเชยของคนอื่น
        const checkMakeupQuery = `
            SELECT id FROM schedules
            WHERE class_date = $1
            AND start_time < $3::time 
            AND end_time > $2::time
            AND status IN ('รอตรวจสอบ', 'อนุมัติแล้ว', 'รอผู้บริหารพิจารณา')
            AND (
                ($4 != '' AND REPLACE(teacher_name, ' ', '') ILIKE '%' || $4 || '%') OR
                ($5 != '' AND $5 != '-' AND TRIM(room_id) ILIKE $5) OR
                ($6 != '' AND (
                    REPLACE(student_group, ' ', '') ILIKE '%' || $6 || '%' OR
                    $6 ILIKE '%' || REPLACE(student_group, ' ', '') || '%'
                ))
            )
            LIMIT 1
        `;
        const makeupConflict = await pool.query(checkMakeupQuery, [class_date, start_time, end_time, cleanTeacherName, cleanRoom, cleanGroup]);

        if (makeupConflict.rows.length > 0) {
             return res.status(400).json({ success: false, message: '❌ ไม่สามารถจองได้: เวลาที่เลือกชนกับการจองชดเชยท่านอื่น (อาจารย์ ห้อง หรือนักศึกษาไม่ว่าง)' });
        }

        // ✅ ด่าน 4: ผ่านทุกเงื่อนไข บันทึกได้เลย
        const insertQuery = `
            INSERT INTO schedules
            (teacher_name, subject_code, subject_name, year_level, student_group, room_id, class_date, start_time, end_time, status, missed_date, reason)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'รอตรวจสอบ', $10, $11)
            RETURNING id
        `;
        const values = [teacher_name, subject_code, subject_name, year_level, student_group, room_id, class_date, start_time, end_time, missed_date, reason];
        const result = await pool.query(insertQuery, values);

        res.json({ success: true, message: '✅ บันทึกคำขอสอนชดเชยสำเร็จ', id: result.rows[0].id });

    } catch (error) {
        console.error('Booking Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
    }
});



app.put('/api/schedules/:id', async (req, res) => {
    const { id } = req.params;
    // 🌟 1. ดึง missed_date และ reason มาจาก req.body เพิ่มเติม
    const { teacher_name, subject_code, year_level, student_group, room_id, class_date, start_time, end_time, missed_date, reason } = req.body;

    try {
        const cleanTeacherName = teacher_name.replace(/\s+/g, '');

        const checkMakeupQuery = `
            SELECT id FROM schedules
            WHERE class_date = $1
            AND start_time::time < $3::time AND end_time::time > $2::time
            AND status IN ('รอตรวจสอบ', 'อนุมัติแล้ว')
            AND (
                REPLACE(teacher_name, ' ', '') = $4 OR room_id = $5 OR student_group = $6
            )
            AND id != $7 
            LIMIT 1
        `;
        const makeupConflict = await pool.query(checkMakeupQuery, [class_date, start_time, end_time, cleanTeacherName, room_id, student_group, id]);

        if (makeupConflict.rows.length > 0) {
             return res.status(400).json({ success: false, message: 'แก้ไขไม่ได้: เวลาที่แก้ใหม่ไปชนกับการจองของท่านอื่น' });
        }

        // 🌟 2. เพิ่ม missed_date = $9 และ reason = $10 เข้าไป (ทำให้ id ต้องขยับไปเป็น $11)
        const updateQuery = `
            UPDATE schedules
            SET teacher_name = $1, subject_code = $2, year_level = $3, student_group = $4, 
                room_id = $5, class_date = $6, start_time = $7, end_time = $8,
                missed_date = $9, reason = $10,
                status = 'รอตรวจสอบ', remark = NULL
            WHERE id = $11
        `;
        
        // 🌟 3. ใส่ค่าลง Array ให้ตรงกับลำดับ $1 ถึง $11
        const values = [
            teacher_name, 
            subject_code, 
            year_level, 
            student_group, 
            room_id, 
            class_date, 
            start_time, 
            end_time, 
            missed_date, // จับคู่กับ $9
            reason,      // จับคู่กับ $10
            id           // จับคู่กับ $11
        ];
        
        await pool.query(updateQuery, values);

        res.json({ success: true, message: 'บันทึกการแก้ไขสำเร็จ' });

    } catch (error) {
        console.error('Update Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล' });
    }
});

// ==========================================
// API: ดึงข้อมูลคำขอสอนชดเชย (อัปเกรดเทียบข้อมูลด้วย รหัสวิชา ป้องกันชื่ออาจารย์ไม่ตรงกัน)
// ==========================================
app.get('/api/schedules', async (req, res) => {
    const { teacher_name } = req.query;

    try {
        // 🌟 เปลี่ยนไปดึงข้อมูล สาขา/คณะ โดยเทียบจาก subject_code แทน teacher_name
        let query = `
            SELECT 
                s.*, 
                (SELECT teacher_title FROM main_classes WHERE subject_code = s.subject_code LIMIT 1) AS title,
                (SELECT subject_name FROM main_classes WHERE subject_code = s.subject_code LIMIT 1) AS subject_name,
                (SELECT theory_hours FROM main_classes WHERE subject_code = s.subject_code LIMIT 1) AS theory_hours,
                (SELECT practical_hours FROM main_classes WHERE subject_code = s.subject_code LIMIT 1) AS practical_hours,
                (SELECT sector FROM main_classes WHERE subject_code = s.subject_code LIMIT 1) AS sector,
                (SELECT branch FROM main_classes WHERE subject_code = s.subject_code LIMIT 1) AS branch,
                (SELECT faculty FROM main_classes WHERE subject_code = s.subject_code LIMIT 1) AS faculty,
                (SELECT curriculum FROM main_classes WHERE subject_code = s.subject_code LIMIT 1) AS curriculum,
                (SELECT start_time FROM main_classes WHERE subject_code = s.subject_code LIMIT 1) AS normal_start_time,
                (SELECT end_time FROM main_classes WHERE subject_code = s.subject_code LIMIT 1) AS normal_end_time,
                (SELECT room_id FROM main_classes WHERE subject_code = s.subject_code LIMIT 1) AS normal_room_id
            FROM schedules s
            WHERE 1=1
        `;
        let values = [];

        if (teacher_name) {
            query += ` AND s.teacher_name = $1`;
            values.push(teacher_name);
        }

        query += ` ORDER BY s.id DESC`;

        const result = await pool.query(query, values);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Fetch Schedules Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
});

// ==========================================
// API: อัปเดตสถานะคำขอ (และหมายเหตุ)
// ==========================================
app.put('/api/schedules/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status, remark } = req.body; // 🌟 รับ remark มาด้วย

    try {
        // 🌟 อัปเดตทั้งสถานะและ remark
        const updateQuery = `
            UPDATE schedules 
            SET status = $1, remark = $2 
            WHERE id = $3
        `;
        await pool.query(updateQuery, [status, remark || null, id]);

        res.json({ success: true, message: 'อัปเดตสถานะสำเร็จ' });
    } catch (error) {
        console.error('Update Status Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
    }
});           
// ==========================================
// API: เข้าสู่ระบบ (อัปเกรดแนบข้อมูล ตำแหน่ง และ สาขากลับไปด้วย)
// ==========================================
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const query = 'SELECT * FROM users WHERE username = $1 AND password = $2';
        const result = await pool.query(query, [username, password]);

        if (result.rows.length > 0) {
            const user = result.rows[0];

            if (user.is_blocked) {
                return res.json({ 
                    success: false, 
                    message: '🚫 บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อแอดมินระบบ' 
                });
            }

            res.json({ 
                success: true, 
                user: { 
                    id: user.id, 
                    username: user.username, 
                    name: user.name, 
                    role: user.role,
                    // 🌟 เพิ่มการส่งข้อมูลเหล่านี้กลับไปให้หน้าเว็บ เผื่อต้องใช้งาน
                    title: user.title,
                    faculty: user.faculty,
                    branch: user.branch,
                    curriculum: user.curriculum
                } 
            });
        } else {
            res.json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
    }
});

// ==========================================
// API: อัปโหลดและอ่านไฟล์ Excel (แปลง นาย/นางสาว เป็น อาจารย์ อัตโนมัติ)
// ==========================================
app.post('/api/upload-excel', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'กรุณาอัปโหลดไฟล์ Excel' });

        const workbook = xlsx.readFile(req.file.path);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const merges = sheet['!merges'] || []; 
        const sheetRange = xlsx.utils.decode_range(sheet['!ref']); 

        const titlePattern = '^(ศาสตราจารย์พิเศษ|ศาสตราจารย์|รองศาสตราจารย์|ผู้ช่วยศาสตราจารย์|อาจารย์|ศ\\.|รศ\\.|ผศ\\.|ดร\\.|นาย|นางสาว|นาง|ว่าที่ร้อยตรี|ว่าที่\\s*ร\\.ต\\.)';
        const titleMatchRegex = new RegExp(titlePattern);
        const titleReplaceRegex = new RegExp(titlePattern + '\\s*', 'g');

        let teacherName = 'ไม่ระบุ';
        let teacherTitle = 'อาจารย์'; 
        let isTeacherFile = false;
        let headerStudentGroup = ''; 
        let yearLevel = ''; 
        let faculty = '';
        let branch = '';
        let curriculum = '';

        for (let r = 0; r < 15; r++) {
            const cell = sheet[xlsx.utils.encode_cell({ r: r, c: 1 })] || sheet[xlsx.utils.encode_cell({ r: r, c: 0 })];
            if (cell && cell.v && typeof cell.v === 'string') {
                const rawText = cell.v.toString().trim();
                const cleanCellText = rawText.replace(/\s+/g, ''); 
                
                if (cleanCellText.startsWith('ชื่อ') && !cleanCellText.includes('วิชา') && cleanCellText.length > 5) {
                    let rawTextWithoutPrefix = rawText.replace(/^ชื่อ\s*(-สกุล)?\s*/, '').replace(/^:/, '').trim();
                    const titleMatch = rawTextWithoutPrefix.match(titleMatchRegex);

                    if (titleMatch) {
                        let tempTitle = titleMatch[0].trim();
                        teacherName = rawTextWithoutPrefix.replace(tempTitle, '').trim();
                        
                        // 🌟 ดักจับ: ถ้ายศเป็น นาย/นาง/นางสาว ให้เปลี่ยนเป็น อาจารย์
                        teacherTitle = ['นาย', 'นาง', 'นางสาว'].includes(tempTitle) ? 'อาจารย์' : tempTitle;
                    } else {
                        const parts = rawTextWithoutPrefix.split(' ');
                        if (parts.length > 1 && parts[0].length > 2) {
                            teacherTitle = parts[0];
                            teacherName = rawTextWithoutPrefix.replace(teacherTitle, '').trim();
                        } else {
                            teacherName = rawTextWithoutPrefix;
                        }
                    }
                    isTeacherFile = true;
                } 
                else if (cleanCellText.startsWith('คณะ')) faculty = rawText.replace(/คณะ\s*/, '').replace(/^:/, '').trim();
                else if (cleanCellText.startsWith('สาขา') && !cleanCellText.startsWith('สาขาวิชา')) branch = rawText.replace(/สาขา\s*/, '').replace(/^:/, '').trim();
                else if (cleanCellText.startsWith('หลักสูตร')) curriculum = rawText.replace(/หลักสูตร\s*/, '').replace(/^:/, '').trim();
                else if (cleanCellText.includes('ปี')) {
                    headerStudentGroup = rawText;
                    const yearMatch = headerStudentGroup.match(/ปี\s*\d+/);
                    if (yearMatch) yearLevel = yearMatch[0];
                }
            }
        }

        if (isTeacherFile && teacherName !== 'ไม่ระบุ') {
            try { await pool.query(`UPDATE users SET faculty = $1, branch = $2, curriculum = $3, title = $4 WHERE name = $5 AND role = 'teacher'`, [faculty, branch, curriculum, teacherTitle, teacherName]); } catch (err) {}
        }

        const dbFac = isTeacherFile ? faculty : null;
        const dbBra = isTeacherFile ? branch : null;
        const dbCur = isTeacherFile ? curriculum : null;

        let colCode = 15, colName = 19, colGroup = 36, colTeacher = -1; 
        for (let r = 0; r < 30; r++) {
            for (let c = 10; c < 60; c++) {
                const cell = sheet[xlsx.utils.encode_cell({ r, c })];
                if (cell && cell.v && typeof cell.v === 'string') {
                    const text = cell.v.toString().replace(/\s+/g, '');
                    if (text === 'รหัสวิชา') colCode = c;
                    else if (text === 'ชื่อวิชา') colName = c;
                    else if (text === 'กลุ่มเรียน') colGroup = c;
                    else if (text === 'อาจารย์ผู้สอน' || text === 'ชื่ออาจารย์ผู้สอน' || text === 'ผู้สอน') colTeacher = c;
                }
            }
        }

        const subjectMap = {};
        const teacherMap = {}; 
        const groupFullNames = {}; 
        const subjectDetailsMap = {}; 

        for (let r = 0; r <= sheetRange.e.r; r++) { 
            const codeCell = sheet[xlsx.utils.encode_cell({ r: r, c: colCode })] || sheet[xlsx.utils.encode_cell({ r: r, c: colCode + 1 })]; 
            
            if (codeCell && codeCell.v) {
                const code = codeCell.v.toString().trim();
                if (code !== 'รหัสวิชา' && code !== 'ชื่อวิชา' && code.length > 2 && !code.includes('รวม')) {
                    const nameCell = sheet[xlsx.utils.encode_cell({ r: r, c: colName })] || sheet[xlsx.utils.encode_cell({ r: r, c: colName + 1 })]; 
                    if (nameCell && nameCell.v) {
                        let sName = nameCell.v.toString().trim();
                        if (sName.includes(' - ')) sName = sName.split(' - ')[0].trim(); 
                        subjectMap[code] = sName;
                    }

                    const groupCell = sheet[xlsx.utils.encode_cell({ r: r, c: colGroup })] || sheet[xlsx.utils.encode_cell({ r: r, c: colGroup + 1 })] || sheet[xlsx.utils.encode_cell({ r: r, c: colGroup - 1 })];
                    let gName = '';
                    if (groupCell && groupCell.v) gName = groupCell.v.toString().trim();

                    if (colTeacher !== -1) {
                        const teacherCell = sheet[xlsx.utils.encode_cell({ r: r, c: colTeacher })] || sheet[xlsx.utils.encode_cell({ r: r, c: colTeacher + 1 })] || sheet[xlsx.utils.encode_cell({ r: r, c: colTeacher - 1 })]; 
                        if (teacherCell && teacherCell.v) {
                            let tName = teacherCell.v.toString().trim();
                            if (tName !== 'อาจารย์ผู้สอน' && tName !== '' && isNaN(tName) && !tName.includes('ปกติ') && !tName.includes('สมทบ') && !tName.includes('พิเศษ')) {
                                
                                let extTitle = 'อาจารย์';
                                const tMatch = tName.match(titleMatchRegex);
                                if (tMatch) {
                                    let tempTitle = tMatch[0].trim();
                                    // 🌟 ดักจับ: ถ้ายศตารางล่างเป็น นาย/นาง/นางสาว ให้เปลี่ยนเป็น อาจารย์
                                    extTitle = ['นาย', 'นาง', 'นางสาว'].includes(tempTitle) ? 'อาจารย์' : tempTitle;
                                }
                                
                                let extName = tName.replace(titleReplaceRegex, '').replace(titleReplaceRegex, '').trim(); 
                                
                                if (gName) {
                                    const shortSec = gName.split(' ')[0].trim(); 
                                    teacherMap[code + '_' + shortSec] = { name: extName, title: extTitle };
                                } else {
                                    teacherMap[code] = { name: extName, title: extTitle }; 
                                }
                            }
                        }
                    }

                    let sectorValue = 'ปกติ', theoryHours = 0, practicalHours = 0, numbersFound = [];
                    for (let c = 44; c <= 49; c++) {
                        const tempCell = sheet[xlsx.utils.encode_cell({ r: r, c: c })];
                        if (tempCell && tempCell.v !== undefined && tempCell.v !== null && tempCell.v !== '') {
                            const valStr = tempCell.v.toString().trim();
                            if (valStr === '-' || valStr === '0') numbersFound.push(0);
                            else if (!isNaN(parseFloat(valStr))) numbersFound.push(parseFloat(valStr));
                            else { if (valStr.includes('ปกติ') || valStr.includes('สมทบ') || valStr.includes('พิเศษ') || valStr.length > 2) sectorValue = valStr; }
                        }
                    }
                    if (numbersFound.length >= 2) { theoryHours = numbersFound[0]; practicalHours = numbersFound[1]; } 
                    else if (numbersFound.length === 1) { theoryHours = numbersFound[0]; }

                    subjectDetailsMap[code] = { sector: sectorValue, theory: theoryHours, practical: practicalHours };

                    for (let c = 30; c <= 60; c++) {
                        const gCell = sheet[xlsx.utils.encode_cell({ r: r, c: c })];
                        if (gCell && gCell.v && typeof gCell.v === 'string') {
                            const cellText = gCell.v.toString().trim();
                            if (cellText.includes('_SEC_') && cellText.includes('-')) {
                                const groupsInCell = cellText.split(/[\n,]/); 
                                for (let g of groupsInCell) {
                                    let cleanGroup = g.trim();
                                    if (cleanGroup.includes('_SEC_') && cleanGroup.includes('-')) {
                                        const shortName = cleanGroup.split(' ')[0].trim(); 
                                        if (shortName) groupFullNames[shortName] = cleanGroup; 
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        for (const [shortName, fullName] of Object.entries(groupFullNames)) {
            try { await pool.query(`INSERT INTO student_groups_master (short_name, full_name) VALUES ($1, $2) ON CONFLICT (short_name) DO UPDATE SET full_name = EXCLUDED.full_name`, [shortName, fullName]); } catch (err) {}
        }

        let startDayRow = -1;
        for (let r = 10; r < 30; r++) {
            const cell = sheet[xlsx.utils.encode_cell({ r: r, c: 0 })];
            if (cell && cell.v && typeof cell.v === 'string' && cell.v.replace(/\s+/g, '').includes('วันจันทร์')) { startDayRow = r; break; }
        }
        if (startDayRow === -1) return res.status(400).json({ success: false, message: 'ไม่พบรูปแบบตารางเรียน' });

        const timeRow = startDayRow - 1; 
        const days = ['วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์', 'วันอาทิตย์'];
        let insertedCount = 0, skippedCount = 0;

        for (let r = startDayRow; r < startDayRow + 50; r++) {
            const dayCell = sheet[xlsx.utils.encode_cell({ r: r, c: 0 })];
            if (!dayCell || !dayCell.v) continue;
            
            const dayStr = dayCell.v.toString().trim();
            if (!days.includes(dayStr)) continue;
            const simpleDay = dayStr.replace('วัน', '').trim();

            for (let c = 1; c < 60; c++) {
                const cell = sheet[xlsx.utils.encode_cell({ r: r, c: c })];
                
                if (cell && cell.v && typeof cell.v === 'string' && cell.v.includes('\n')) {
                    const mergeRange = merges.find(m => m.s.r === r && m.s.c === c);
                    if (mergeRange) {
                        const parts = cell.v.split('\n').map(p => p.trim()).filter(p => p !== '');
                        
                        if (parts.length >= 3) {
                            let subjectCode = parts[0].split(' ')[0].trim();
                            let subjectName = subjectMap[subjectCode] || ''; 
                            const roomId = parts[parts.length - 1];

                            let groupsArray = [];
                            for (let i = 1; i < parts.length - 1; i++) {
                                let g = parts[i];
                                if (!isTeacherFile && headerStudentGroup && !g.includes('ปี')) g = `${g} - ${headerStudentGroup}`;
                                groupsArray.push(g);
                            }
                            let studentGroup = groupsArray.join(' | ');

                            let teacherKey = subjectCode + '_' + groupsArray[0].split(' ')[0].trim();
                            let currentTeacher = 'ไม่ระบุ';
                            let currentTitle = 'อาจารย์';
                            
                            if (isTeacherFile) {
                                currentTeacher = teacherName;
                                currentTitle = teacherTitle;
                            } else {
                                const tObj = teacherMap[teacherKey] || teacherMap[subjectCode];
                                if (tObj) {
                                    currentTeacher = tObj.name || 'ไม่ระบุ';
                                    currentTitle = tObj.title || 'อาจารย์';
                                }
                            }

                            let startTime = '', endTime = '';
                            for (let tc = mergeRange.s.c; tc <= mergeRange.e.c; tc++) {
                                const tCell = sheet[xlsx.utils.encode_cell({ r: timeRow, c: tc })];
                                if (tCell && tCell.v && tCell.v.toString().includes('-')) { startTime = tCell.v.toString().split('-')[0].trim(); break; }
                            }
                            for (let tc = mergeRange.e.c; tc >= mergeRange.s.c; tc--) {
                                const tCell = sheet[xlsx.utils.encode_cell({ r: timeRow, c: tc })];
                                if (tCell && tCell.v && tCell.v.toString().includes('-')) { endTime = tCell.v.toString().split('-')[1].trim(); break; }
                            }

                            if (startTime && endTime) {
                                if (startTime.length < 5) startTime = '0' + startTime;
                                if (endTime.length < 5) endTime = '0' + endTime;

                                const details = subjectDetailsMap[subjectCode] || { sector: 'ปกติ', theory: 0, practical: 0 };
                                const checkConsecutiveQuery = `SELECT m.id FROM main_classes m JOIN class_student_groups csg ON m.id = csg.class_id WHERE m.day_of_week = $1 AND m.end_time = $2 AND m.room_id = $3 AND m.subject_code = $4 AND csg.student_group = $5`;
                                const consecRes = await pool.query(checkConsecutiveQuery, [simpleDay, startTime, roomId, subjectCode, studentGroup]);

                                if (consecRes.rows.length > 0) {
                                    await pool.query(`UPDATE main_classes SET end_time = $1, faculty = COALESCE($2, faculty), branch = COALESCE($3, branch), curriculum = COALESCE($4, curriculum), teacher_title = COALESCE($5, teacher_title) WHERE id = $6`, [endTime, dbFac, dbBra, dbCur, currentTitle, consecRes.rows[0].id]);
                                    skippedCount++; continue; 
                                }

                                const checkQuery = `SELECT m.id FROM main_classes m JOIN class_student_groups csg ON m.id = csg.class_id WHERE m.day_of_week = $1 AND m.start_time = $2 AND csg.student_group = $3`;
                                const { rows } = await pool.query(checkQuery, [simpleDay, startTime, studentGroup]);

                                if (rows.length === 0) {
                                    const mainQuery = `SELECT id FROM main_classes WHERE day_of_week = $1 AND start_time = $2 AND room_id = $3 AND subject_code = $4`;
                                    const mainRes = await pool.query(mainQuery, [simpleDay, startTime, roomId, subjectCode]);
                                    let mainClassId;
                                    if (mainRes.rows.length > 0) {
                                        mainClassId = mainRes.rows[0].id;
                                        if (currentTeacher !== 'ไม่ระบุ') await pool.query(`UPDATE main_classes SET teacher_name = $1, teacher_title = COALESCE($2, teacher_title) WHERE id = $3 AND teacher_name = 'ไม่ระบุ'`, [currentTeacher, currentTitle, mainClassId]);
                                        await pool.query(`UPDATE main_classes SET theory_hours = $1, practical_hours = $2, sector = $3, faculty = COALESCE($4, faculty), branch = COALESCE($5, branch), curriculum = COALESCE($6, curriculum) WHERE id = $7`, [details.theory, details.practical, details.sector, dbFac, dbBra, dbCur, mainClassId]);
                                    } else {
                                        const insertMain = `INSERT INTO main_classes (subject_code, subject_name, teacher_name, teacher_title, day_of_week, start_time, end_time, room_id, theory_hours, practical_hours, sector, faculty, branch, curriculum) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`;
                                        const newMain = await pool.query(insertMain, [subjectCode, subjectName, currentTeacher, currentTitle, simpleDay, startTime, endTime, roomId, details.theory, details.practical, details.sector, dbFac, dbBra, dbCur]);
                                        mainClassId = newMain.rows[0].id;
                                    }
                                    await pool.query(`INSERT INTO class_student_groups (class_id, student_group) VALUES ($1, $2)`, [mainClassId, studentGroup]);
                                    insertedCount++;
                                } else {
                                    if (currentTeacher !== 'ไม่ระบุ') await pool.query(`UPDATE main_classes SET teacher_name = $1, teacher_title = COALESCE($2, teacher_title) WHERE id = $3`, [currentTeacher, currentTitle, rows[0].id]);
                                    await pool.query(`UPDATE main_classes SET theory_hours = $1, practical_hours = $2, sector = $3, faculty = COALESCE($4, faculty), branch = COALESCE($5, branch), curriculum = COALESCE($6, curriculum) WHERE id = $7`, [details.theory, details.practical, details.sector, dbFac, dbBra, dbCur, rows[0].id]);
                                    skippedCount++;
                                }
                            }
                        }
                    }
                }
            }
        }
        const modeText = isTeacherFile ? `${teacherTitle} ${teacherName}` : 'กลุ่มนักศึกษา';
        res.json({ success: true, message: `อัปโหลดตารางสำเร็จ! โหมด: ${modeText} (ข้อมูลใหม่: ${insertedCount} | ผสาน/อัปเดต: ${skippedCount}) 🎊` });
    } catch (error) { console.error('Upload Error:', error); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการอ่านรูปแบบไฟล์ Excel' }); }
});



// ==========================================
// API: ค้นหาตารางสอนของอาจารย์ 
// ==========================================
app.get('/api/teacher-classes', async (req, res) => {
    const { teacherName, forBooking } = req.query;
    try {
        const cleanName = teacherName ? teacherName.replace(/\s+/g, '') : '';

        const regRes = await pool.query(`
            SELECT 
                m.*, 
                m.teacher_title AS title, -- 🌟 1. ดึงคำนำหน้ามาด้วยเพื่อเอาไปแสดงผล
                -- 🌟 แทรก COALESCE ไว้ใน ARRAY_AGG เพื่อแปลชื่อก่อนมัดรวมกัน
                ARRAY_AGG(COALESCE(g.full_name, csg.student_group)) as groups
            FROM main_classes m
            LEFT JOIN class_student_groups csg ON m.id = csg.class_id
            -- 🌟 JOIN ตาราง Master ของเราเข้าไปเทียบรหัส
            LEFT JOIN student_groups_master g ON csg.student_group = g.short_name
            WHERE REPLACE(m.teacher_name, ' ', '') ILIKE $1
            GROUP BY m.id
        `, [`%${cleanName}%`]);
        
        // 🌟 แปลงร่างเป็น student_group กลับคืนมา
        const regularClasses = regRes.rows.map(row => {
            // 🌟 2. ดักจับ Sec ควบ (แตกข้อความที่มี | ออกเป็นชิ้นๆ ก่อนส่งให้ mergeAndCleanGroups)
            let expandedGroups = [];
            if (row.groups) {
                row.groups.forEach(g => {
                    if (g) {
                        g.split('|').forEach(subG => expandedGroups.push(subG.trim()));
                    }
                });
            }

            return {
                ...row,
                student_group: mergeAndCleanGroups(expandedGroups)
            };
        });

        if (forBooking === 'true') {
            return res.json({ success: true, data: regularClasses });
        }

        const makeupRes = await pool.query(`
            SELECT s.*,
                   (SELECT teacher_title FROM main_classes WHERE teacher_name = s.teacher_name LIMIT 1) AS title -- 🌟 1. ดึงคำนำหน้าให้คาบชดเชยด้วย
            FROM schedules s
            WHERE REPLACE(s.teacher_name, ' ', '') ILIKE $1 
            AND s.status = 'อนุมัติแล้ว' 
            AND (s.class_date > CURRENT_DATE OR (s.class_date = CURRENT_DATE AND s.end_time >= CURRENT_TIME))
        `, [`%${cleanName}%`]);

        const daysThai = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        
        // 🌟 บังคับดึงเวลาไทย และแปลเป็นวันภาษาไทยตรงๆ (จะได้ "วันเสาร์")
        const makeupClasses = makeupRes.rows.map(m => {
            const thaiDay = new Date(m.class_date).toLocaleDateString('th-TH', {
                weekday: 'long',
                timeZone: 'Asia/Bangkok'
            });
            const correctDay = thaiDay.replace('วัน', ''); // ตัดคำว่า "วัน" ออกให้เหลือแค่ "เสาร์"

            return {
                ...m,
                day_of_week: correctDay, // 🌟 1. ได้วันเสาร์ชัวร์ 1,000,000%
                subject_code: `${m.subject_code} (ชดเชย)`,
                isMakeup: true // 🌟 2. ธงเปลี่ยนสี
            };
        });

        res.json({ success: true, data: [...regularClasses, ...makeupClasses] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});


app.get('/api/admin/users', async (req, res) => {
    try {
        const query = 'SELECT id, username, name, role, is_blocked FROM users ORDER BY id ASC';
        const result = await pool.query(query);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Fetch Users Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสมาชิก' });
    }
});

app.put('/api/admin/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, role, is_blocked } = req.body;

    try {
        const query = `
            UPDATE users 
            SET name = $1, role = $2, is_blocked = $3 
            WHERE id = $4
        `;
        await pool.query(query, [name, role, is_blocked, id]);
        res.json({ success: true, message: 'อัปเดตข้อมูลสมาชิกสำเร็จ!' });
    } catch (error) {
        console.error('Update User Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล' });
    }
});

app.delete('/api/admin/users/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const query = 'DELETE FROM users WHERE id = $1';
        await pool.query(query, [id]);
        res.json({ success: true, message: 'ลบสมาชิกออกจากระบบสำเร็จ!' });
    } catch (error) {
        console.error('Delete User Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการลบสมาชิก' });
    }
});

app.post('/api/admin/users', async (req, res) => {
    const { username, password, name, role } = req.body;

    if (!username || !password || !name || !role) {
        return res.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    try {
        const checkQuery = 'SELECT id FROM users WHERE username = $1';
        const checkResult = await pool.query(checkQuery, [username]);
        
        if (checkResult.rows.length > 0) {
            return res.json({ success: false, message: 'Username นี้มีในระบบแล้ว กรุณาใช้ชื่ออื่น' });
        }

        const insertQuery = `
            INSERT INTO users (username, password, name, role, is_blocked) 
            VALUES ($1, $2, $3, $4, false)
        `;
        await pool.query(insertQuery, [username, password, name, role]);
        
        res.json({ success: true, message: 'เพิ่มสมาชิกใหม่เรียบร้อยแล้ว!' });
    } catch (error) {
        console.error('Add User Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเพิ่มสมาชิก' });
    }
});

app.get('/api/executive/stats', async (req, res) => {
    try {

        // 1. สรุปจำนวนตามสถานะ
        const statusQuery = `
            SELECT status, COUNT(*)::int AS count
            FROM schedules
            GROUP BY status
        `;

        // 2. Leaderboard อาจารย์ที่ขอมากสุด พร้อม approved/rejected
        const leaderboardQuery = `
    SELECT
        teacher_name,
        COUNT(*)::int AS count,
        COUNT(*)::int AS approved,
        0::int        AS rejected
    FROM schedules
    WHERE status = 'อนุมัติแล้ว'
    GROUP BY teacher_name
    ORDER BY count DESC
    LIMIT 5
`;

        // 3. เทรนด์รายเดือน พร้อม approved แยก
        const trendQuery = `
            SELECT
                TO_CHAR(class_date, 'Mon')                                           AS month,
                COUNT(*)::int                                                        AS count,
                COUNT(*) FILTER (WHERE status = 'อนุมัติแล้ว')::int                 AS approved,
                MIN(class_date)                                                      AS sort_date
            FROM schedules
            GROUP BY TO_CHAR(class_date, 'Mon')
            ORDER BY MIN(class_date)
        `;

        // 4. วิชาที่ขอชดเชยบ่อยสุด — JOIN main_classes เพื่อเอาชื่อวิชา
        const subjectQuery = `
            SELECT
                s.subject_code,
                SPLIT_PART(
                    (SELECT mc.subject_name FROM main_classes mc 
                    WHERE mc.subject_code = s.subject_code LIMIT 1),
                ' - ', 1) AS subject_name,
                COUNT(*)::int AS count
            FROM schedules s
            WHERE s.status = 'อนุมัติแล้ว'
            GROUP BY s.subject_code
            ORDER BY count DESC
            LIMIT 10
        `;


        // 5. สรุปเหตุผลที่ไม่อนุมัติ
        const rejectionQuery = `
            SELECT
                COALESCE(NULLIF(TRIM(reason), ''), '(ไม่ระบุ)') AS reason,
                COUNT(*)::int AS count
            FROM schedules
            WHERE status = 'ไม่อนุมัติ'
            GROUP BY reason
            ORDER BY count DESC
        `;

        // 6. สถิติรายอาจารย์ครบถ้วน (ใช้ใน tab รายอาจารย์)
       const teacherStatsQuery = `
    SELECT
        teacher_name,
        COUNT(*)::int AS total,      
        COUNT(*)::int AS approved,   
        0::int        AS rejected
    FROM schedules
    WHERE status = 'อนุมัติแล้ว'
    GROUP BY teacher_name
    ORDER BY total DESC
`;

        // รัน query ทั้งหมดพร้อมกัน
        const [
            statusRes,
            leaderboardRes,
            trendRes,
            subjectRes,
            rejectionRes,
            teacherStatsRes,
        ] = await Promise.all([
            pool.query(statusQuery),
            pool.query(leaderboardQuery),
            pool.query(trendQuery),
            pool.query(subjectQuery),
            pool.query(rejectionQuery),
            pool.query(teacherStatsQuery),
        ]);

        res.json({
            success:          true,
            statusCounts:     statusRes.rows,
            leaderboard:      leaderboardRes.rows,
            monthlyTrend:     trendRes.rows,
            subjectRanking:   subjectRes.rows,
            rejectionReasons: rejectionRes.rows,
            teacherStats:     teacherStatsRes.rows,
        });

    } catch (error) {
        console.error('Executive Stats Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงสถิติ' });
    }
});

app.put('/api/executive/approve/:id', async (req, res) => {
    const { id } = req.params;
    const { status, remark } = req.body; 

    try {
        const query = `
            UPDATE schedules 
            SET status = $1, remark = $2, approved_at = NOW() 
            WHERE id = $3
        `;
        await pool.query(query, [status, remark, id]);
        res.json({ success: true, message: `ดำเนินการ ${status} เรียบร้อยแล้ว` });
    } catch (error) {
        console.error('Approval Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกการอนุมัติ' });
    }
});

// ==========================================
// API: ค้นหาตารางเรียนนักศึกษา 
// ==========================================
app.get('/api/student-classes', async (req, res) => {
    const { group } = req.query;
    try {
        const regRes = await pool.query(`
            SELECT m.*, ARRAY_AGG(csg.student_group) as groups
            FROM main_classes m
            LEFT JOIN class_student_groups csg ON m.id = csg.class_id
            WHERE m.id IN (SELECT class_id FROM class_student_groups WHERE student_group ILIKE $1)
            GROUP BY m.id
        `, [`%${group}%`]);
        
        // 🌟 แปลงร่างเป็น student_group กลับคืนมา
        const regularClasses = regRes.rows.map(row => ({
            ...row,
            student_group: mergeAndCleanGroups(row.groups)
        }));

        const makeupRes = await pool.query(`
            SELECT * FROM schedules 
            WHERE student_group LIKE $1 
            AND status = 'อนุมัติแล้ว' 
            AND (class_date > CURRENT_DATE OR (class_date = CURRENT_DATE AND end_time >= CURRENT_TIME))
        `, [`%${group}%`]);

        const daysThai = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        // ==========================================
        // 🌟 ท่อนจัดการข้อมูลชดเชย สำหรับ API ของนักศึกษา
        // ==========================================
        const makeupClasses = makeupRes.rows.map(m => {
            // บังคับดึงเวลาไทย และแปลเป็นวันภาษาไทยตรงๆ
            const thaiDay = new Date(m.class_date).toLocaleDateString('th-TH', {
                weekday: 'long',
                timeZone: 'Asia/Bangkok'
            });
            const correctDay = thaiDay.replace('วัน', ''); // ตัดคำว่า "วัน" ออกให้เหลือแค่ จันทร์-อาทิตย์

            return {
                ...m,
                day_of_week: correctDay, // 🌟 1. ได้วันเสาร์ชัวร์ 1,000,000%
                subject_code: `${m.subject_code} (ชดเชย)`,
                isMakeup: true // 🌟 2. ธงเปลี่ยนสีเป็นเหลือง/ส้ม
            };
        });
        
        // (อย่าลืมเอา makeupClasses ไปรวมกับ regularClasses ด้วยคำสั่งคล้ายๆ แบบนี้นะครับ)
        // const allClasses = [...regularClasses, ...makeupClasses];
        // res.json({ success: true, data: allClasses });

        res.json({ success: true, data: [...regularClasses, ...makeupClasses] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

// ==========================================
// API สำหรับดึงกลุ่มเรียนของวิชานั้นๆ (อัปเกรดแก้ปัญหาตัวเลือกซ้ำซ้อน + แสดงชื่อเต็ม)
// ==========================================
app.get('/api/groups-by-subject', async (req, res) => {
    const { code, teacherName } = req.query;
    try {
        // ตัดช่องว่างออกจากชื่ออาจารย์
        const cleanName = teacherName ? teacherName.replace(/\s+/g, '') : '';

        // 🌟 1. แก้ไข SQL ให้จัดกลุ่มเป็น Array (groups) ตามคาบเรียน (m.id)
        // 🌟 2. ใช้ ILIKE คู่กับ REPLACE เพื่อหาชื่ออาจารย์แบบไม่สนช่องว่าง
        const query = `
            SELECT 
                m.id, 
                ARRAY_AGG(COALESCE(g.full_name, csg.student_group)) AS groups
            FROM main_classes m
            LEFT JOIN class_student_groups csg ON m.id = csg.class_id
            LEFT JOIN student_groups_master g ON csg.student_group = g.short_name
            WHERE m.subject_code = $1 
            AND REPLACE(m.teacher_name, ' ', '') ILIKE $2
            GROUP BY m.id
        `;
                
        const result = await pool.query(query, [code, `%${cleanName}%`]);
        
        const uniqueOptions = new Set();
        
        result.rows.forEach(row => {
            // ตอนนี้ row.groups จะมีข้อมูลส่งมาจาก ARRAY_AGG แล้วครับ
            if (row.groups && row.groups.length > 0) {
                
                // 🌟 [จุดที่เติมเข้าไป]: แตกข้อความที่มีเครื่องหมาย | ออกเป็นชิ้นๆ ก่อน
                let expandedGroups = [];
                row.groups.forEach(g => {
                    if (g) {
                        g.split('|').forEach(subG => expandedGroups.push(subG.trim()));
                    }
                });

                // กรองชื่อกลุ่มให้สมบูรณ์ (เปลี่ยนจาก row.groups มาใช้ expandedGroups แทน)
                let validGroups = expandedGroups.filter(Boolean);
                validGroups.sort((a, b) => b.length - a.length);
                
                const keptGroups = [];
                validGroups.forEach(g => {
                    const cleanG = g.replace(/\s+/g, ''); 
                    const isDuplicate = keptGroups.some(kept => kept.replace(/\s+/g, '').includes(cleanG));
                    if (!isDuplicate) keptGroups.push(g);
                });
                
                // 🌟 จุดที่แก้ไข: สร้างแค่ 1 ตัวเลือก ต่อ 1 คาบเรียนเท่านั้น! 
                if (keptGroups.length > 0) {
                    uniqueOptions.add(keptGroups.sort().join(' | '));
                }
            }
        });

        res.json({ success: true, data: Array.from(uniqueOptions).sort() });
    } catch (error) {
        console.error("Error fetching groups:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// API: อัปโหลดไฟล์ Excel แปลชื่อกลุ่มเรียน (Master Data)
// ==========================================
app.post('/api/upload-groups-master', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'กรุณาอัปโหลดไฟล์ Excel' });
        }

        const workbook = xlsx.readFile(req.file.path);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        // อ่านข้อมูลแบบแถวต่อแถว
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }); 

        let insertedCount = 0;

        // วนลูปอ่านข้อมูล (สมมติว่า คอลัมน์ A = รหัสสั้น, คอลัมน์ B = ชื่อเต็ม)
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (row.length >= 2) {
                const shortName = row[0]?.toString().trim();
                const fullName = row[1]?.toString().trim();

                // ข้ามบรรทัดที่เป็นหัวตาราง หรือบรรทัดว่าง
                if (shortName && fullName && shortName !== 'รหัสสั้น') {
                    // ใช้คำสั่ง UPSERT: ถ้ามีรหัสนี้แล้วให้อัปเดตชื่อ ถ้ายังไม่มีให้เพิ่มใหม่
                    const query = `
                        INSERT INTO student_groups_master (short_name, full_name)
                        VALUES ($1, $2)
                        ON CONFLICT (short_name) DO UPDATE SET full_name = EXCLUDED.full_name
                    `;
                    await pool.query(query, [shortName, fullName]);
                    insertedCount++;
                }
            }
        }

        res.json({ success: true, message: `อัปเดตรายชื่อกลุ่มเรียนสำเร็จจำนวน ${insertedCount} กลุ่ม! 🎉` });
    } catch (error) {
        console.error('Upload Master Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการอ่านไฟล์ Excel' });
    }
});

// ==========================================
// API: ยกเลิก/ลบคำขอสอนชดเชย
// ==========================================
app.delete('/api/schedules/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'DELETE FROM schedules WHERE id = $1 RETURNING id',
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'ไม่พบรายการที่ต้องการลบ' });
        }
        res.json({ success: true, message: 'ยกเลิกรายการสำเร็จ' });
    } catch (error) {
        console.error('Delete Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการลบข้อมูล' });
    }
});

// ==========================================
// API: ดึงรายชื่ออาจารย์และสาขา (เวอร์ชันกรองชื่อซ้ำและดึงสาขาจริงมาถม)
// ==========================================
app.get('/api/teachers-list', async (req, res) => {
    try {
        // 🌟 1. ดึงข้อมูลดิบออกมาก่อน
        const query = `
            SELECT 
                TRIM(teacher_name) AS teacher_name, 
                curriculum, 
                teacher_title AS title
            FROM main_classes 
            WHERE teacher_name IS NOT NULL AND TRIM(teacher_name) NOT IN ('', 'ไม่ระบุ')
        `;
        const result = await pool.query(query);

        // 🌟 2. ใช้ JavaScript จัดกลุ่มและรวมร่างข้อมูล (แก้ปัญหาเคาะ Spacebar ไม่เท่ากัน)
        const teacherMap = {};

        result.rows.forEach(row => {
            if (!row.teacher_name) return;
            
            // ลบช่องว่างทั้งหมดออก เพื่อใช้เป็น Key เทียบว่าใช่คนเดียวกันไหม
            const cleanKey = row.teacher_name.replace(/\s+/g, '');

            if (!teacherMap[cleanKey]) {
                teacherMap[cleanKey] = {
                    name: row.teacher_name.replace(/\s+/g, ' '), // จัดช่องว่างให้เหลือแค่ 1 เคาะสวยๆ
                    curriculum: row.curriculum,
                    title: row.title || 'อาจารย์'
                };
            } else {
                // 🌟 ถ้าระบบเจอชื่ออาจารย์คนเดิมซ้ำ ให้ดึง "สาขาจริง" มาถมใส่ในช่องที่เคยเป็นค่าว่าง (null) จากตาราง นศ.
                if (!teacherMap[cleanKey].curriculum && row.curriculum) {
                    teacherMap[cleanKey].curriculum = row.curriculum;
                }
                // ถ้าเจอตำแหน่งที่ละเอียดกว่าคำว่า "อาจารย์" ให้อัปเดตตำแหน่งด้วย
                if (teacherMap[cleanKey].title === 'อาจารย์' && row.title && row.title !== 'อาจารย์') {
                    teacherMap[cleanKey].title = row.title;
                }
            }
        });

        // 🌟 3. แปลงกลับเป็น Array และส่งให้หน้าเว็บ
        const finalTeachers = Object.values(teacherMap).map(t => ({
            teacher_name: t.name,
            curriculum: t.curriculum,
            title: t.title
        }));

        res.json({ success: true, data: finalTeachers });
    } catch (error) {
        console.error('Fetch Teachers Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงรายชื่ออาจารย์' });
    }
});

// ==========================================
// API: ดึงข้อมูลสถิติภาพรวม (สำหรับ Dashboard)
// ==========================================
app.get('/api/dashboard-stats', async (req, res) => {
    try {
        // นับจำนวนทั้งหมด
        const totalRes = await pool.query('SELECT COUNT(*) FROM schedules');
        
        // นับจำนวนที่อนุมัติแล้ว
        const approvedRes = await pool.query("SELECT COUNT(*) FROM schedules WHERE status = 'อนุมัติแล้ว'");
        
        // นับจำนวนที่รอตรวจสอบ (รวมทุกสถานะที่ยังไม่เสร็จสิ้น)
        const pendingRes = await pool.query("SELECT COUNT(*) FROM schedules WHERE status IN ('รอตรวจสอบ', 'รออนุมัติ', 'รอผู้บริหารพิจารณา')");

        res.json({
            success: true,
            data: {
                total: parseInt(totalRes.rows[0].count),
                approved: parseInt(approvedRes.rows[0].count),
                pending: parseInt(pendingRes.rows[0].count)
            }
        });
    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถิติ' });
    }
});

// ==========================================
// API: ดึงข้อมูลกราฟสถิติ (แยกตามวันที่สร้างคำขอ 7 วันย้อนหลัง)
// ==========================================
app.get('/api/chart-data', async (req, res) => {
    try {
        // จัดกลุ่มตามวันที่ และนับจำนวนคำขอ (ใช้ของ PostgreSQL)
        const query = `
            SELECT TO_CHAR(created_at, 'DD/MM/YYYY') as date, COUNT(*) as requests
            FROM schedules
            GROUP BY DATE(created_at), TO_CHAR(created_at, 'DD/MM/YYYY')
            ORDER BY DATE(created_at) DESC
            LIMIT 7
        `;
        const result = await pool.query(query);

        // กลับด้าน Array ให้อดีตอยู่ซ้าย ปัจจุบันอยู่ขวา เพื่อให้กราฟอ่านง่ายขึ้น
        const chartData = result.rows.reverse().map(row => ({
            date: row.date,
            requests: parseInt(row.requests)
        }));

        res.json({ success: true, data: chartData });
    } catch (error) {
        console.error('Chart Data Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลกราฟ' });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`🚀 เซิร์ฟเวอร์กำลังทำงานอยู่ที่พอร์ต ${PORT}`);
});