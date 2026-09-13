from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


OUTPUT_DIR = Path("outputs/inventory-goods-donation-two-proof-sample").resolve()
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


DONATIONS = [
    {
        "row": 2,
        "item": "Rice",
        "quantity": "40 sacks",
        "donor": "Sample Community Donor A",
        "pdf": "row-2-rice-document.pdf",
        "image": "row-2-rice-image.png",
        "color": (31, 122, 55),
    },
    {
        "row": 3,
        "item": "Bottled Water",
        "quantity": "24 cases",
        "donor": "Sample Community Donor B",
        "pdf": "row-3-water-document.pdf",
        "image": "row-3-water-image.png",
        "color": (21, 101, 192),
    },
]


def write_png(path, donation):
    width, height = 900, 520
    accent = donation["color"]
    image = Image.new("RGB", (width, height), (247, 252, 248))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle([34, 34, width - 34, height - 34], radius=18, fill=(255, 255, 255), outline=(190, 216, 194), width=3)
    draw.rounded_rectangle([34, 34, width - 34, 122], radius=18, fill=accent)
    draw.rectangle([34, 86, width - 34, 122], fill=accent)
    for x in range(60, width - 60, 44):
        for y in range(170, 390, 44):
            color = (231, 244, 235) if (x + y) % 88 == 0 else (244, 249, 245)
            draw.rectangle([x, y, x + 30, y + 30], fill=color)

    try:
        title_font = ImageFont.truetype("arialbd.ttf", 36)
        heading_font = ImageFont.truetype("arialbd.ttf", 34)
        body_font = ImageFont.truetype("arial.ttf", 26)
    except OSError:
        title_font = heading_font = body_font = ImageFont.load_default()

    draw.text((62, 58), f"Photo proof - Excel Row {donation['row']}", fill=(255, 255, 255), font=title_font)
    draw.text((62, 166), donation["item"], fill=(18, 53, 31), font=heading_font)
    draw.text((62, 224), f"Quantity: {donation['quantity']}", fill=(18, 53, 31), font=body_font)
    draw.text((62, 276), f"Donor: {donation['donor']}", fill=(18, 53, 31), font=body_font)
    draw.text((62, 356), "Sample image proof for upload testing.", fill=(18, 53, 31), font=body_font)
    image.save(path, "PNG")


def write_pdf(path, donation):
    doc = SimpleDocTemplate(str(path), pagesize=letter, rightMargin=56, leftMargin=56, topMargin=52, bottomMargin=52)
    styles = getSampleStyleSheet()
    body = []
    body.append(Paragraph(f"Document Proof - Excel Row {donation['row']}", styles["Title"]))
    body.append(Spacer(1, 18))
    body.append(Paragraph("Sample proof document for imported goods donation testing.", styles["BodyText"]))
    body.append(Spacer(1, 18))
    table = Table(
        [
            ["Field", "Value"],
            ["Item Name", donation["item"]],
            ["Quantity", donation["quantity"]],
            ["Source Type", "Donated"],
            ["Source Name", donation["donor"]],
        ],
        colWidths=[150, 300],
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f7a37")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#bfd8c2")),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f7fcf8")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    body.append(table)
    body.append(Spacer(1, 20))
    body.append(Paragraph("Attach this PDF to the matching row only.", styles["BodyText"]))
    doc.build(body)


for donation in DONATIONS:
    write_pdf(OUTPUT_DIR / donation["pdf"], donation)
    write_png(OUTPUT_DIR / donation["image"], donation)

readme = """Inventory goods donation import sample

Use this Excel file for the import:
- inventory-goods-donation-two-sample.xlsx

After importing, attach these proofs per row:
- Excel Row 2 / Rice: row-2-rice-document.pdf and row-2-rice-image.png
- Excel Row 3 / Bottled Water: row-3-water-document.pdf and row-3-water-image.png

The Excel importer reads the donation data only. Upload the matching PDF and image inside the app after import.
"""
(OUTPUT_DIR / "README.txt").write_text(readme, encoding="utf-8")
