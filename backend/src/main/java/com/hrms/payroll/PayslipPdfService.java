package com.hrms.payroll;

import com.hrms.domain.Employee;
import com.hrms.domain.Payslip;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.Month;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Hand-rolled minimal PDF generator for payslips. Outputs a single A4 page with
 * standard PDF 1.4 structure. No external library ??? keeps dependencies light.
 */
@Service
public class PayslipPdfService {

    public byte[] render(Payslip p) {
        try {
            PdfBuilder b = new PdfBuilder();
            Employee e = p.getEmployee();

            // Page geometry (A4 in points: 595 x 842)
            float pageW = 595, pageH = 842;
            float marginL = 50, marginR = 50;
            float y = pageH - 60;

            b.beginText();
            b.font("F1", 22).fillColor(0.18f, 0.49f, 0.20f);
            b.text(marginL, y, "HRMS Payroll");
            b.font("F1", 11).fillColor(0.42f, 0.52f, 0.45f);
            b.text(marginL, y - 18, "Salary statement");

            // Right side: month header
            String monthLabel = Month.of(p.getMonth()).getDisplayName(TextStyle.FULL, Locale.ENGLISH) + " " + p.getYear();
            b.font("F1", 14).fillColor(0.10f, 0.21f, 0.16f);
            b.textRight(pageW - marginR, y, monthLabel);
            b.font("F1", 10).fillColor(0.42f, 0.52f, 0.45f);
            b.textRight(pageW - marginR, y - 18, "Payslip #" + p.getId());
            b.endText();
            y -= 50;

            // Divider
            b.line(marginL, y, pageW - marginR, y, 0.85f, 0.92f, 0.86f, 1.0f);
            y -= 16;

            // Employee info block
            b.beginText().font("F1", 11).fillColor(0.10f, 0.21f, 0.16f);
            b.text(marginL, y, "Employee");
            b.font("F1", 13).text(marginL, y - 16, e.getFirstName() + " " + e.getLastName());
            b.font("F1", 10).fillColor(0.42f, 0.52f, 0.45f);
            b.text(marginL, y - 32, "Code: " + e.getEmployeeCode());
            if (e.getDesignation() != null)
                b.text(marginL, y - 46, "Designation: " + e.getDesignation());
            if (e.getDepartment() != null)
                b.text(marginL, y - 60, "Department: " + e.getDepartment().getName());

            // Right block: working days
            b.font("F1", 10).fillColor(0.42f, 0.52f, 0.45f);
            b.textRight(pageW - marginR, y, "WORKING DAYS");
            b.font("F1", 16).fillColor(0.10f, 0.21f, 0.16f);
            b.textRight(pageW - marginR, y - 18, String.valueOf(p.getWorkingDays()));
            b.font("F1", 10).fillColor(0.42f, 0.52f, 0.45f);
            b.textRight(pageW - marginR, y - 36, "Paid days: " + p.getPaidDays());
            b.endText();
            y -= 86;

            // Earnings header
            b.rect(marginL, y - 20, pageW - marginL - marginR, 22, 0.85f, 0.94f, 0.86f);
            b.beginText().font("F1", 10).fillColor(0.10f, 0.21f, 0.16f);
            b.text(marginL + 12, y - 14, "EARNINGS");
            b.textRight(pageW - marginR - 12, y - 14, "AMOUNT (INR)");
            b.endText();
            y -= 28;

            y = drawRow(b, marginL, pageW - marginR, y, "Basic", p.getBasic());
            y = drawRow(b, marginL, pageW - marginR, y, "House Rent Allowance", p.getHra());
            y = drawRow(b, marginL, pageW - marginR, y, "Other allowances", p.getAllowances());

            // Gross row
            b.line(marginL, y - 4, pageW - marginR, y - 4, 0.85f, 0.92f, 0.86f, 1.0f);
            y -= 22;
            b.beginText().font("F1", 11).fillColor(0.10f, 0.21f, 0.16f);
            b.text(marginL + 12, y, "Gross earnings");
            b.textRight(pageW - marginR - 12, y, money(p.getGrossSalary()));
            b.endText();
            y -= 24;

            // Deductions header
            b.rect(marginL, y - 20, pageW - marginL - marginR, 22, 0.99f, 0.91f, 0.91f);
            b.beginText().font("F1", 10).fillColor(0.41f, 0.10f, 0.10f);
            b.text(marginL + 12, y - 14, "DEDUCTIONS");
            b.textRight(pageW - marginR - 12, y - 14, "AMOUNT (INR)");
            b.endText();
            y -= 28;
            y = drawRow(b, marginL, pageW - marginR, y, "Deductions", p.getDeductions());

            // Net pay box
            y -= 14;
            b.rect(marginL, y - 40, pageW - marginL - marginR, 44, 0.85f, 0.94f, 0.86f);
            b.beginText().font("F1", 11).fillColor(0.10f, 0.21f, 0.16f);
            b.text(marginL + 14, y - 14, "Net pay");
            b.font("F1", 10).fillColor(0.42f, 0.52f, 0.45f);
            b.text(marginL + 14, y - 30, "(Gross ??? Deductions)");
            b.font("F1", 18).fillColor(0.10f, 0.49f, 0.20f);
            b.textRight(pageW - marginR - 14, y - 22, "??? " + money(p.getNetSalary()));
            b.endText();
            y -= 70;

            // Footer
            b.beginText().font("F1", 9).fillColor(0.55f, 0.55f, 0.55f);
            b.text(marginL, 50, "Generated by HRMS ?? " + p.getGeneratedAt().toString());
            b.textRight(pageW - marginR, 50, "This is a computer-generated document. Signature not required.");
            b.endText();

            return b.build();
        } catch (IOException ex) {
            throw new RuntimeException("Failed to render payslip PDF", ex);
        }
    }

    private float drawRow(PdfBuilder b, float x1, float x2, float y, String label, BigDecimal amount) throws IOException {
        b.beginText().font("F1", 10).fillColor(0.10f, 0.21f, 0.16f);
        b.text(x1 + 12, y, label);
        b.textRight(x2 - 12, y, money(amount));
        b.endText();
        return y - 18;
    }

    private static String money(BigDecimal v) {
        if (v == null) v = BigDecimal.ZERO;
        return v.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    /* ===================================================================== */
    /* Tiny PDF builder ??? produces a valid, single-page PDF 1.4 document.   */
    /* ===================================================================== */
    private static class PdfBuilder {
        private final StringBuilder content = new StringBuilder();
        private boolean inText = false;
        private float curR = 0, curG = 0, curB = 0;
        private boolean colorSet = false;
        private String curFont = null; private float curSize = 0;

        PdfBuilder beginText() { content.append("BT\n"); inText = true; return this; }
        PdfBuilder endText()   { content.append("ET\n"); inText = false; return this; }

        PdfBuilder font(String name, float size) {
            // PDF font + size only valid inside a text object
            if (!inText) throw new IllegalStateException("font() outside text");
            if (!name.equals(curFont) || size != curSize) {
                content.append("/").append(name).append(" ").append(fmt(size)).append(" Tf\n");
                curFont = name; curSize = size;
            }
            return this;
        }

        PdfBuilder fillColor(float r, float g, float b) {
            content.append(fmt(r)).append(" ").append(fmt(g)).append(" ").append(fmt(b)).append(" rg\n");
            curR = r; curG = g; curB = b; colorSet = true;
            return this;
        }

        PdfBuilder text(float x, float y, String s) {
            content.append("1 0 0 1 ").append(fmt(x)).append(" ").append(fmt(y)).append(" Tm\n");
            content.append("(").append(escape(s)).append(") Tj\n");
            return this;
        }

        // Right-aligned text. Estimates width using a per-char average of curSize * 0.5
        // (Helvetica). Good enough for our short labels and amounts.
        PdfBuilder textRight(float xRight, float y, String s) {
            float avgW = curSize * 0.5f;
            float w = s.length() * avgW;
            return text(xRight - w, y, s);
        }

        PdfBuilder line(float x1, float y1, float x2, float y2, float r, float g, float b, float thick) {
            // graphics state must be outside text
            content.append("q\n");
            content.append(fmt(r)).append(" ").append(fmt(g)).append(" ").append(fmt(b)).append(" RG\n");
            content.append(fmt(thick)).append(" w\n");
            content.append(fmt(x1)).append(" ").append(fmt(y1)).append(" m ");
            content.append(fmt(x2)).append(" ").append(fmt(y2)).append(" l S\n");
            content.append("Q\n");
            return this;
        }

        PdfBuilder rect(float x, float y, float w, float h, float r, float g, float b) {
            content.append("q\n");
            content.append(fmt(r)).append(" ").append(fmt(g)).append(" ").append(fmt(b)).append(" rg\n");
            content.append(fmt(x)).append(" ").append(fmt(y)).append(" ").append(fmt(w)).append(" ").append(fmt(h)).append(" re f\n");
            content.append("Q\n");
            return this;
        }

        byte[] build() throws IOException {
            byte[] streamBytes = content.toString().getBytes(StandardCharsets.UTF_8);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            List<Integer> offsets = new ArrayList<>();

            writeAscii(out, "%PDF-1.4\n%????????\n");

            // 1: Catalog
            offsets.add(out.size());
            writeAscii(out, "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
            // 2: Pages
            offsets.add(out.size());
            writeAscii(out, "2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n");
            // 3: Page
            offsets.add(out.size());
            writeAscii(out, "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
                    "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n");
            // 4: Content stream
            offsets.add(out.size());
            writeAscii(out, "4 0 obj\n<< /Length " + streamBytes.length + " >>\nstream\n");
            out.write(streamBytes);
            writeAscii(out, "\nendstream\nendobj\n");
            // 5: Font
            offsets.add(out.size());
            writeAscii(out, "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

            int xrefOffset = out.size();
            writeAscii(out, "xref\n0 6\n0000000000 65535 f \n");
            for (int o : offsets) {
                writeAscii(out, String.format("%010d 00000 n \n", o));
            }
            writeAscii(out, "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + xrefOffset + "\n%%EOF\n");
            return out.toByteArray();
        }

        private static void writeAscii(ByteArrayOutputStream o, String s) {
            o.writeBytes(s.getBytes(StandardCharsets.ISO_8859_1));
        }

        private static String escape(String s) {
            StringBuilder b = new StringBuilder(s.length() + 8);
            for (int i = 0; i < s.length(); i++) {
                char c = s.charAt(i);
                if (c == '(' || c == ')' || c == '\\') b.append('\\').append(c);
                else if (c < 0x20 || c > 0x7E) {
                    // Replace non-Latin1 chars with a question mark to avoid encoding issues with Helvetica
                    b.append('?');
                } else b.append(c);
            }
            return b.toString();
        }

        private static String fmt(float f) {
            if (f == (int) f) return String.valueOf((int) f);
            return String.format(Locale.ROOT, "%.2f", f);
        }
    }
}
