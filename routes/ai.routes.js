const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const { buildSalesStats } = require('../utils/analytics');

const router = express.Router();

router.use(authMiddleware, adminMiddleware);

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// System instruction rieng cho tinh nang AI PHAN TICH DOANH SO.
// Nguyen tac quan trong: AI CHI duoc nhan dinh/khuyen nghi dua tren so lieu
// duoc cung cap san (tu buildSalesStats), TUYET DOI khong duoc tu bia them
// bat ky con so moi nao khong co trong du lieu dau vao.
const ANALYTICS_SYSTEM_INSTRUCTION = `
Ban la chuyen gia phan tich kinh doanh (business analyst) cho san thuong mai
dien tu san pham so "TRAN THANH GIAU". Ban se nhan vao mot doi tuong JSON
chua so lieu THAT duoc trich xuat tu co so du lieu (doanh thu, top san pham,
ton kho, so luong nguoi dung...). Nhiem vu cua ban la doc va dua ra nhan dinh,
TUYET DOI KHONG duoc bia them bat ky con so nao khong co trong du lieu duoc cung cap.

Tra ve DUY NHAT mot doi tuong JSON theo dung cau truc sau, khong giai thich gi
them, khong bao boc trong markdown (khong dung \`\`\`):

{
  "summary": string,            // Tom tat tong quan tinh hinh kinh doanh, 2-4 cau, bang tieng Viet
  "highlights": string[],       // 3-5 diem noi bat (tang truong, san pham hot, danh muc manh...)
  "topProductAdvice": string,   // Nhan dinh ve san pham/danh muc ban chay nhat va goi y khai thac them
  "pricingAdvice": string,      // Goi y ve chien luoc gia dua tren du lieu hien co
  "restockAlerts": string[],    // Canh bao cac san pham sap het hang can nhap them (dua vao lowStockProducts)
  "riskWarnings": string[]      // Canh bao rui ro neu co (doanh thu giam, danh muc yeu, it nguoi dung...)
}

Neu mot muc khong co du lieu de nhan dinh (vi du khong co san pham sap het hang),
tra ve mang rong [] cho muc do, khong duoc bia noi dung.
`.trim();

function extractJson(rawText) {
  // Phong truong hop model van vo tinh boc trong ```json ... ```
  const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('AI khong tra ve duoc JSON hop le.');
  }
  const jsonString = cleaned.slice(firstBrace, lastBrace + 1);
  return JSON.parse(jsonString);
}

// =========================================================
// POST /api/ai/analyze-sales
// AI Phan tich doanh so: lay so lieu THAT tu DB (buildSalesStats), gui cho
// Gemini de dua ra nhan dinh/khuyen nghi bang ngon ngu tu nhien. So lieu tho
// (stats) cung duoc tra ve kem theo de Admin doi chieu, dam bao minh bach.
// =========================================================
router.post('/analyze-sales', async (req, res, next) => {
  try {
    if (!genAI) {
      return res.status(500).json({
        message: 'Chua cau hinh GEMINI_API_KEY trong file .env, khong the goi AI Automation.',
      });
    }

    const stats = await buildSalesStats();

    // Neu chua co giao dich nao, tra ve ngay khong can goi AI (tiet kiem chi phi API)
    if (stats.totalSalesCount === 0) {
      return res.json({
        stats,
        insights: {
          summary: 'Cửa hàng chưa phát sinh giao dịch mua hàng nào. Hãy đăng thêm sản phẩm và quảng bá để có dữ liệu phân tích.',
          highlights: [],
          topProductAdvice: 'Chưa có dữ liệu bán hàng để đưa ra nhận định về sản phẩm nổi bật.',
          pricingAdvice: 'Chưa có dữ liệu để đề xuất chiến lược giá.',
          restockAlerts: stats.lowStockProducts.map((p) => `${p.title} (còn ${p.available})`),
          riskWarnings: [],
        },
      });
    }

    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: ANALYTICS_SYSTEM_INSTRUCTION,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.4,
      },
    });

    const result = await model.generateContent(JSON.stringify(stats));
    const rawText = result.response.text();

    let insights;
    try {
      insights = extractJson(rawText);
    } catch (parseErr) {
      return res.status(502).json({
        message: 'AI tra ve du lieu khong dung dinh dang JSON, vui long thu lai.',
        stats,
        raw: rawText,
      });
    }

    res.json({ stats, insights });
  } catch (err) {
    // Loi tu Gemini (sai key, het quota, sai model...) -> bao ro cho admin thay vi 500 kho hieu
    if (/API key|quota|429|403|404|GoogleGenerativeAI/i.test(String(err.message))) {
      return res.status(502).json({ message: 'Khong goi duoc Gemini AI (kiem tra GEMINI_API_KEY / GEMINI_MODEL / han muc). Cua hang van hoat dong binh thuong.' });
    }
    next(err);
  }
});

module.exports = router;
