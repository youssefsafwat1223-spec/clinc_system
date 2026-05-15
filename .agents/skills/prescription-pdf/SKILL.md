---
name: prescription-pdf
description: Use this skill when implementing, redesigning, or fixing a medical/dental prescription preview, print layout, or browser Save-as-PDF flow. It focuses on professional A4 prescription documents, Arabic RTL support, clinic letterhead, print CSS, and preserving existing API/data flow.
---

# Prescription PDF / Print Layout Skill

## Goal

Implement a professional medical/dental prescription preview that prints cleanly as an A4 PDF from the browser.

The app screen may use the existing dark UI theme, but the printed/PDF output must be a clean white medical document.

## When to use this skill

Use this skill when the task mentions any of:

- prescription
- prescription PDF
- روشتة
- طباعة روشتة
- حفظ PDF
- print stylesheet
- A4 medical document
- dental prescription
- doctor prescription preview

## Core principles

1. Keep the current API/data flow unchanged unless absolutely required.
2. Prefer frontend-only changes when the required data already exists.
3. Do not introduce backend/schema changes unless the user explicitly approves them.
4. Make the screen UI consistent with the app design system.
5. Make the print/PDF output clean, white, readable, and professional.
6. Support Arabic RTL layout.
7. Keep the prescription readable for doctors and patients.
8. Run the build after implementation and summarize changed files.

## Recommended data sources

Use existing prescription/page data first.

For clinic letterhead, fetch public clinic settings from:

```txt
/settings/public
```

Use available fields such as:

- clinic name
- phone
- address
- logo
- doctor/clinic public info, if available

Do not block the page if some fields are missing. Use graceful fallbacks.

## Required prescription paper sections

The printable prescription should include:

### Header / letterhead

- Clinic logo if available
- Clinic name
- Clinic phone
- Clinic address
- Optional email/social/contact info if already available
- Prescription date

### Patient block

- Patient name
- Patient phone if available
- Patient age if available
- Gender if available
- Date
- Doctor name if available

### Main body

- Large classic `℞` symbol
- Diagnosis section
- Numbered medication list

Each medication should show, when available:

- drug/medicine name
- dose
- frequency
- duration
- timing/instructions
- notes

Medication rows must be easy to scan.

### Dental-specific sections

If the system has dental data, include:

- tooth notes
- tooth number / area
- procedure notes
- treatment instructions

Do not invent clinical data. Only render what exists.

### Footer

- Doctor signature line
- Clinic footer/contact info
- Optional small disclaimer if already present in the product

## Print / PDF behavior

Add a clear button:

```txt
طباعة / حفظ PDF
```

The button may call:

```js
window.print()
```

or use the existing print flow if one already exists.

Use a dedicated print stylesheet with `@media print`.

In print mode:

1. Hide app UI:

- sidebar
- header
- navigation
- buttons
- filters
- forms
- dark backgrounds
- non-prescription UI

2. Show only the prescription paper.

3. Force print-safe styling:

- white background
- dark readable text
- no app shadows
- no dark theme colors
- no gradients

4. Use A4 sizing.

5. Avoid splitting medication rows between pages.

6. Preserve Arabic RTL text.

## Suggested CSS

Use or adapt this pattern:

```css
@media print {
  @page {
    size: A4;
    margin: 12mm;
  }

  html,
  body {
    background: #ffffff !important;
    color: #111111 !important;
  }

  .no-print,
  .app-sidebar,
  .app-header,
  nav,
  button,
  .print-hidden {
    display: none !important;
  }

  .print-only {
    display: block !important;
  }

  .prescription-print-root {
    display: block !important;
    background: #ffffff !important;
  }

  .prescription-paper {
    width: 100%;
    min-height: auto;
    margin: 0 auto;
    padding: 0;
    background: #ffffff !important;
    color: #111111 !important;
    box-shadow: none !important;
    border: none !important;
    direction: rtl;
  }

  .prescription-medication-row,
  .prescription-section {
    break-inside: avoid;
    page-break-inside: avoid;
  }
}
```

## Suggested component structure

If the current prescriptions page is large, split the preview into focused components:

```txt
PrescriptionPreview.jsx
PrescriptionPrintButton.jsx
PrescriptionMedicationList.jsx
PrescriptionPrintStyles.css
```

Keep the refactor scoped. Do not rewrite unrelated page logic.

## Screen design requirements

The app screen can stay dark, but the preview should look like a document card.

Recommended screen layout:

- Dark app background
- Prescription form/editor on one side if existing
- Prescription preview card on the other side or below on mobile
- Sticky save/send/print actions if useful
- Clear loading and error states

Use existing shared components if available, such as:

- DataCard
- PrimaryButton
- Field
- inputClass
- PageHeader
- LoadingSpinner
- EmptyState

Do not introduce a new visual system.

## Arabic / RTL rules

1. Main prescription content should support `dir="rtl"`.
2. Keep medicine names readable if they are English.
3. Use logical spacing and alignment.
4. Arabic labels should be clear:

- اسم المريض
- التاريخ
- التشخيص
- العلاج
- الجرعة
- المدة
- التعليمات
- ملاحظات
- توقيع الطبيب

## Safety and correctness

1. Do not invent medicines, diagnoses, doses, or instructions.
2. Render missing fields as empty, `—`, or hide the field.
3. Do not change prescription data saving logic unless required.
4. Do not break create/edit/send prescription flow.
5. Do not add PDF libraries unless browser print is insufficient and the user approves.
6. Prefer browser print because it is simple and reliable for Save as PDF.

## Testing checklist

After implementation, test:

1. Open existing prescription.
2. Create or preview a new prescription.
3. Confirm clinic letterhead appears from `/settings/public`.
4. Click `طباعة / حفظ PDF`.
5. In browser print dialog, choose Save as PDF.
6. Confirm only the prescription prints.
7. Confirm A4 layout.
8. Confirm Arabic text is RTL.
9. Confirm medicine rows are not split badly.
10. Confirm sidebar/header/buttons do not print.
11. Confirm empty optional fields do not break the layout.
12. Run the build.

## Final response format after implementation

When finished, summarize:

```txt
Done.

Changed files:
- ...

Behavior changed:
- ...

How to test:
- ...

Notes / risks:
- ...
```
