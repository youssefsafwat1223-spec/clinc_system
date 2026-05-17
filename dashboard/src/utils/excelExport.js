const escapeXml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const safeSheetName = (name) => String(name || 'Sheet').replace(/[\[\]\*\/\\\?\:]/g, ' ').slice(0, 31);

const cellType = (value) => (typeof value === 'number' && Number.isFinite(value) ? 'Number' : 'String');

const worksheetXml = (sheet) => `
  <Worksheet ss:Name="${escapeXml(safeSheetName(sheet.name))}" ss:RightToLeft="1">
    <Table>
      ${(sheet.rows || [])
        .map(
          (row, rowIndex) => `
            <Row>
              ${row
                .map((cell) => {
                  const styleId = rowIndex === 0 ? 'Header' : 'Cell';
                  return `<Cell ss:StyleID="${styleId}"><Data ss:Type="${cellType(cell)}">${escapeXml(cell)}</Data></Cell>`;
                })
                .join('')}
            </Row>`
        )
        .join('')}
    </Table>
  </Worksheet>`;

export const downloadExcelWorkbook = (filename, sheets) => {
  const validSheets = sheets.filter((sheet) => sheet?.rows?.length);
  const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
      <Alignment ss:Horizontal="Right"/>
    </Style>
    <Style ss:ID="Cell">
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
      <Alignment ss:Horizontal="Right"/>
    </Style>
  </Styles>
  ${validSheets.map(worksheetXml).join('')}
</Workbook>`;

  const blob = new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

export const formatExcelDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ar-EG');
};
