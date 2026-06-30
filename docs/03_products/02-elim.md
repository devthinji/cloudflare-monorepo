# Elim — CBC Education Agent

## Problem

Kenya's Competence Based Curriculum (CBC) is a significant shift from the old 8-4-4 system:
- Teachers spend hours creating CBC-aligned exam papers manually
- Students in rural areas have never used a computer or seen AI
- Parents have no visibility into their child's learning progress
- Institutions lack real-time class performance statistics
- Revision materials are scarce and expensive

## Solution

Elim is a WhatsApp-based education agent that:
1. **Helps teachers** generate CBC-aligned exams in minutes
2. **Tutors students** through conversation
3. **Provides parents** with progress reports and alerts
4. **Gives institutions** class-wide statistics via dashboard

> A student who has never seen a computer types to Elim on a borrowed phone. Elim teaches, tests, remembers, and reports.

## User Flows

### Student Tutorship
```
Student: "Hi"
Elim:    "Habari! Mimi ni Elim, msaidizi wako wa masomo.
          Jina lako ni nani na uko darasa gani?"
Student: "Amina, Grade 6"
Elim:    "Sawa Amina! Leo tunasoma nini? Maths, English, Science?"
Student: "Maths"
Elim:    "Vizuri. Hebu tuanze na fractions.
          1/2 + 1/4 = ? Jibu hapa chini."
Student: "3/4"
Elim:    "Sahihi kabisa! Sasa jaribu hii: 2/3 + 1/6 = ?"
...
Elim:    "Leo umefanya vizuri sana Amina. Score yako: 8/10."
```

### Teacher — Exam Generation
```
Teacher: "Nitengenezee exam ya Science Grade 5, CBC strand 3"
Elim:    "Sawa. Swali ngapi? Multiple choice au open-ended?"
Teacher: "20 questions, mixed"
Elim:    "Ninatengeneza... ✅ Exam iko ready: [download .docx]
          Je, unataka marking scheme pia?"
```

### Parent Progress Report
```
Parent:  "Habari za Amina masomoni?"
Elim:    "Habari! Amina amefanya vizuri wiki hii:
          Maths: 8/10 (improving)
          English: 6/10 (needs reading practice)
          Science: 9/10 (excellent!)"
```

## CBC Alignment

Elim understands the CBC structure:
- **Learning Areas** (Strands)
- **Sub-strands** and **Specific Learning Outcomes (SLOs)**
- **Core Competencies**: Communication, Critical Thinking, Creativity, Citizenship, Digital Literacy, Learning to Learn, Self-efficacy
- **Assessment criteria** per grade level

## Memory Design

Elim remembers per student:
- Profile (name, grade, school, parent contact)
- All past sessions and scores
- Weak areas and learning patterns
- Documents generated (exams, revision notes)
- Parent notification history

## Stakeholder Views

| Stakeholder | What they get |
|-------------|---------------|
| Student | Tutorship, revision docs, encouragement |
| Teacher | Exam generation, class stats, marking schemes |
| Parent | Weekly progress reports via WhatsApp |
| Institution | Dashboard: class performance, attendance, trends |

## Documents Generated

| Document | Description |
|----------|-------------|
| Exam paper | CBC-aligned, grade-specific, strand-specific |
| Marking scheme | Auto-generated with the exam |
| Revision notes | Summarized topics per strand |
| Progress report | Individual student report card |
| Class statistics | Institution-level performance summary |

## Impact Metric

> Providing real-time AI-assisted education to students who have never seen a computer, in their language, on a phone they already have.
