from datetime import datetime
from reportlab.pdfgen import canvas
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import letter
from reportlab.platypus import Paragraph, SimpleDocTemplate, Table, TableStyle, ListFlowable, ListItem
from reportlab.graphics.shapes import *
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


def getSummary(csaf):

    if "notes" in csaf["document"]:
    
        for note in csaf["document"]["notes"]:
            if (note["category"] == "summary"):
                return note["text"]

    return ""


def getVulSummary(vul):

    if "notes" in vul:
        for note in vul["notes"]:
            if (note["category"] == "summary"):
                return note["text"]
    return ""

def getVulStatements(vul):
    stmts = []
    if "notes" in vul:
        for note in vul["notes"]:
            if note["category"] == "description" and "Vendor Statement" in note["title"]:
                stmts.append(note)

    return stmts

def getVulProducts(vul):

    status = []

    for key, val in vul["product_status"].items():
        status.append({"status": key, "products": val})

    return status

def createBadge(text):
    table = Table([[f"TLP: {text.upper()}"]], hAlign="LEFT")
    fontcolor = colors.whitesmoke
    
    if (text == "AMBER"):
        color = colors.Color(1.0, 0.75, 0.0)
        
    elif (text == "RED"):
        color = colors.red
    elif (text == "GREEN"):
        color = colors.green
    elif (text == "WHITE"):
        color = colors.whitesmoke
        fontcolor = colors.black
        
    table_style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), color),  # Header row background
        ('TEXTCOLOR', (0, 0), (-1, 0), fontcolor), # Header row text color
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'), # Header row font
        ('ROUNDEDCORNERS', [5, 5, 5, 5]),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'), # Center align all cells
        #('BOTTOMPADDING', (0, 0), (-1, 0), 12), # Header row padding
        ('GRID', (0, 0), (-1, -1), 1, color) # All cell borders
    ])
    
    
    table.setStyle(table_style)
    return table



def gen_prod_tree(tree):

    temp_prod = []
    for branch in tree:
        vendor = ""
        product = ""
        version = ""
        name = ""
        prod_id = ""
    
        if branch["category"] == "vendor":
            vendor = branch["name"]
            if ("branches" in branch):
                for pn in branch["branches"]:
                    if pn["category"] in ["product_name", "product_family", "architecture"]:
                        product = pn["name"]
                        if "branches" in pn:
                            for pv in pn["branches"]:
                                if ("branches" in pv):
                                    if hasattr(pv["branches"], "__len__"):
                                        for pc in pv["branches"]:
                                            version = pc["name"]
                                            name= pc["product"]["name"]
                                            prod_id = pc["product"]["product_id"]
                                            temp_prod.append({"id": prod_id, "name": name, "version": version, "product": product, "vendor": vendor})
                                else: 
                                    version = pv["name"]
                                    name= pv["product"]["name"]
                                    prod_id = pv["product"]["product_id"]
                                    temp_prod.append({"id": prod_id, "name": name, "version": version, "product": product, "vendor": vendor})
            else:
                version = ""
                name = branch["name"]
                prod_id = branch["product"]["product_id"]
                temp_prod.append({"id": prod_id, "name": name, "version": version, "product": product, "vendor": vendor})


    return temp_prod


def get_product_from_tree(prod_tree, prod):

    if (prod):
        if (':' in prod):
            newproid = prod.split(':')
            for y in prod_tree:
                if (y["id"] == newproid[1]):
                    return y

    logger.debug(prod_tree)
    for y in prod_tree:
        if prod == y["id"]:
            return y


def gen_table(products, prod_tree):

    table = [["Vendor", "Product", "Version", "Status"]]
    styles = getSampleStyleSheet()
    styleN = styles['Normal']
    
    for prod in products:
        for pid in prod["products"]:
            prod_info = get_product_from_tree(prod_tree, pid)
            table.append([Paragraph(prod_info["vendor"], styleN), Paragraph(prod_info["product"], styleN), prod_info["version"], prod["status"].replace("_", " ")])

    logger.debug(table)
    return table


def create_doc_revision_table(history):

    table = [["Date", "Version", "Summary"]]

    for rev in history:
        dt = datetime.strptime(rev["date"], "%Y-%m-%dT%H:%M:%SZ")
        table.append([dt.strftime("%Y-%m-%d %H:%M:%S"), rev["number"], rev["summary"]])

    return table


def generate_csaf_pdf(buffer, csaf):


    styles = getSampleStyleSheet()
    styleN = styles['Normal']
    styleH = styles['Heading1']
    styleH2 = styles['Heading2']
    styleH3 = styles['Heading3']
    styleH4 = styles['Heading4']
    story = []

    prod_tree = gen_prod_tree(csaf["product_tree"]["branches"])

    logger.debug(prod_tree)
    
    #add some flowables
    if "distribution" in csaf["document"]:
        if 'tlp' in csaf["document"]["distribution"]:
            
            d = createBadge(csaf["document"]["distribution"]["tlp"]["label"])
            story.append(d)

    para_style = ParagraphStyle('basic', parent=styleH, spaceAfter=0.1*inch, spaceBefore=0.1*inch)
    para_extra_space = ParagraphStyle('basic_normal', parent=styleN, spaceAfter=0.1*inch)
    story.append(Paragraph(f'{csaf["document"]["tracking"]["id"]}: {csaf["document"]["title"]}', para_style))

    initial = datetime.strptime(csaf["document"]["tracking"]["initial_release_date"], "%Y-%m-%dT%H:%M:%SZ")
    revised = datetime.strptime(csaf["document"]["tracking"]["current_release_date"], "%Y-%m-%dT%H:%M:%SZ")
    story.append(Paragraph(f'<b>Release Date</b>: {initial.strftime("%Y-%m-%d %H:%M:%S")}', para_extra_space))
    story.append(Paragraph(f'Document Status: <b>{csaf["document"]["tracking"]["status"].upper()}</b>', para_extra_space))
    if (initial != revised):
        story.append(Paragraph(f'Last Revised: {revised.strftime("%Y-%m-%d %H:%M:%S")}', para_extra_space))

    summary = getSummary(csaf)
    if summary:
        story.append(Paragraph("Summary", styleH3))
    
        story.append(Paragraph(summary,styleN))

    story.append(Paragraph("Vulnerabilities", styleH2))

    
    table_style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),  # Header row background
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke), # Header row text color
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'), # Center align all cells
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'), # Header row font
        #('BOTTOMPADDING', (0, 0), (-1, 0), 12), # Header row padding
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige), # Data rows background
        ('GRID', (0, 0), (-1, -1), 1, colors.black) # All cell borders
    ])
    
    if "vulnerabilities" in csaf:
    
        for vul in csaf["vulnerabilities"]:

            vsummary = getVulSummary(vul)
            products = getVulProducts(vul)
            statements = getVulStatements(vul)

            
            story.append(Paragraph(f'{vul["cve"]}: {vul["title"]}', styleH3))
            story.append(Paragraph(vsummary, styleN))
            story.append(Paragraph("Affected Products", styleH3))

            tb = gen_table(products, prod_tree)
            available_width = A4[0] - (2 * inch)
            cwpc = available_width / 4
            table = Table(tb, colWidths=[cwpc, cwpc, cwpc, cwpc])

            table.setStyle(table_style)

            story.append(table)


            #TODO add remediations

            if (len(statements) > 0):
                
                story.append(Paragraph('Vendor Statements', styleH3))                
            
            for statement in statements:
                story.append(Paragraph(f"<b>{statement['title']}:</b> {statement['text']}", styleN))

            story.append(Paragraph('Metrics', styleH3))                
                
            if "cwe" in vul and len(vul["cwe"]):
                story.append(Paragraph(f"<b>Problem Types:</b> {vul['cwe']['id']}: {vul['cwe']['name']}", para_extra_space))

            for x in vul["notes"]:
                if x["title"] == "SSVC":
                    story.append(Paragraph(f"{x['text']}", para_extra_space))

            if "scores" in vul:
                for score in vul["scores"]:
                    for x,y in score.items():
                        if "cvss_v3" in x:
                            story.append(Paragraph(f"{y['vectorString']} Score: {y['baseScore']} Severity: {y['baseSeverity']}", styleN))

            if "acknowledgements" in vul:
                story.append(Paragraph('Metrics', styleH3))

                for ack in vul["acknowledgments"]:
                    if 'names' in ack and 'organization' in ack:
                        story.append(Paragraph(f"{vul['cve']} was reported by {ack['names'].join(', ')} {ack['organization']}", styleN))
                    elif 'names' in ack:
                        story.append(Paragraph(f"{vul['cve']} was reported by {ack['names'].join(', ')}", styleN))
                    elif 'organization' in ack:
                        story.append(Paragraph(f"{vul['cve']} was reported by {ack['organization']}", styleN))
            if 'references' in vul:
                story.append(Paragraph('References', styleH3))

                bullets = {}
                
                for ref in vul["references"]:
                    if ref['category'] in bullets:
                        bullets[ref['category']].append(ListItem(Paragraph(ref['url'], styleN)))
                    else:
                        bullets[ref['category']] = [ListItem(Paragraph(ref['url'], styleN))]
                for x, y in bullets.items():
                    if (x != "self"):
                        story.append(Paragraph(f"<b>{x}</b>", styleN))
                    story.append(ListFlowable(y, bulletType='bullet'))
                        

    if 'acknowledgments' in csaf["document"]:

        story.append(Paragraph('Acknowledgments', styleH2))

        for ack in csaf['document']['acknowledgments']:
            if 'names' in ack and len(ack['names']) and 'organization' in ack:

                story.append(Paragraph(f"Thanks to {', '.join(ack['names'])} from {ack['organization']} for supporting this vulnerability disclosure effort.", styleN))
            elif 'names' in ack and len(ack['names']):
                story.append(Paragraph(f"Thanks to {', '.join(ack['names'])} for supporting this vulnerability disclosure effort.", styleN))
            elif 'organization' in ack:
                story.append(Paragraph(f"Thanks to {ack['organization']} for supporting this vulnerability disclosure effort", styleN))


    if 'references' in csaf['document']:

        story.append(Paragraph('Document References', styleH2))

        bullets = {}
        
        for ref in csaf['document']['references']:
            if ref['category'] in bullets:
                bullets[ref['category']].append(ListItem(Paragraph(ref['url'], styleN)))
            else:
                bullets[ref['category']] = [ListItem(Paragraph(ref['url'], styleN))]

        for x, y in bullets.items():
            if (x != "self"):
                story.append(Paragraph(f"<b>{x}</b>", styleN))
            story.append(ListFlowable(y, bulletType='bullet'))
        
        
    story.append(Paragraph('Document Revision History', styleH2))        

    if ("tracking" in csaf["document"]):
        if ("revision_history" in csaf["document"]["tracking"]):
            doc_rev = create_doc_revision_table(csaf["document"]["tracking"]["revision_history"])
            available_width = A4[0] - (2 * inch)
            cwpc = available_width / 3
            table = Table(doc_rev, colWidths=[cwpc, cwpc/2, cwpc + cwpc/2])
            table.setStyle(table_style)
             
            story.append(table)
             
             
            
    doc = SimpleDocTemplate(buffer, pagesize = letter)
    doc.build(story)
    
    #p = canvas.Canvas(buffer)
    #p.drawString(60, 750, f'{csaf["document"]["tracking"]["id"]}: {csaf["document"]["title"]}')

    return doc
