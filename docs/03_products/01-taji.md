# Taji — Career Documentation Agent

## Problem

Unemployment in Kenya is significantly worsened by poor documentation. Many qualified job seekers:
- Have never written a professional CV
- Don't know how to tailor an application letter to a specific job
- Write resignation letters that burn bridges
- Can't afford a career consultant
- Don't have access to a computer or Microsoft Word

## Solution

Taji is a WhatsApp agent that **guides users through a conversation** to gather their information and generates professional, employer-ready documents — sent back as a downloadable file.

> "Tell me about yourself" → 5 messages later → professional CV in their hands.

## User Flow

### CV Creation
```
User:  "Nataka CV" (I want a CV)
Taji:  "Sawa! Niambie jina lako kamili na kazi unayotafuta."
User:  "John Kamau, natafuta kazi ya accounting"
Taji:  "Vizuri John. Una elimu gani? Andika chuo na course."
User:  "University of Nairobi, Bachelor of Commerce, 2019"
Taji:  "Una uzoefu wa kazi? Niambie kampuni na kazi uliyofanya."
User:  "KCB Bank, teller, 2019-2022. Safaricom, finance analyst, 2022-sasa"
Taji:  "Nzuri sana. Namba ya simu na email yako?"
User:  "0712345678, john@email.com"
Taji:  "Nakutengenezea CV yako... ✅ Hapa: [download link]"
       "Unataka niongeze skills au objective statement?"
```

### Application Letter
```
User:  "Nataka application letter kwa job ya accountant KRA"
Taji:  "Nzuri. Je, una CV kwangu tayari?"
User:  "Ndiyo"
Taji:  "Sawa, nitatumia details zako. Paste job description hapa."
User:  [pastes job description]
Taji:  "Nakuandikia... ✅ Application letter iko ready: [download link]"
```

### Resignation Letter
```
User:  "Nataka kuacha kazi"
Taji:  "Pole. Nitakusaidia kuandika resignation letter vizuri.
        Unaondoka lini? Na unataka sababu gani tuandike?"
```

## Memory Design

Taji remembers:
- User's profile (name, education, experience, contacts)
- Previously generated documents
- Conversation history per session
- Reminders for follow-ups ("Je, ulipata interview?")

## Documents Generated

| Document | Template | Output |
|----------|----------|--------|
| CV | docx template | .docx + PDF link |
| Application Letter | docx template | .docx |
| Resignation Letter | docx template | .docx |
| Cover Letter | docx template | .docx |

## Impact Metric

> Reduction in unemployment through better documentation access for people who have never had professional career support.

## Revenue Model (Future)

- Free: 1 CV, 1 letter/month
- Premium: Unlimited docs, LinkedIn optimization, interview prep
- B2B: NGOs, universities, job fairs bulk packages
