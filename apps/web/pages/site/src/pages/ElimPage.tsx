import { Link } from 'react-router-dom'
import { GraduationCap, CheckCircle, ArrowRight } from 'lucide-react'

const FEATURES = [
  'CBC curriculum aligned — Grades 4 to 9',
  'Step-by-step exam question breakdowns',
  'Past paper practice with instant feedback',
  'Tracks progress for students, parents, and teachers',
  'Works on WhatsApp, Telegram, and SMS',
]

export default function ElimPage() {
  return (
    <div className="max-w-4xl mx-auto px-5 py-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center">
          <GraduationCap className="text-green-600" size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Elim</h1>
          <p className="text-gray-500 text-sm">CBC education agent</p>
        </div>
      </div>

      <p className="text-lg text-gray-600 mb-12 leading-relaxed max-w-2xl">
        Elim is an AI tutor built for the Kenyan Competency Based Curriculum. Students get real help, parents get visibility, and teachers get a tireless assistant — all via chat.
      </p>

      {/* Features */}
      <div className="bg-gray-50 rounded-2xl p-8 mb-12">
        <h2 className="font-semibold text-gray-900 mb-5 text-lg">What Elim can do</h2>
        <ul className="space-y-3">
          {FEATURES.map(f => (
            <li key={f} className="flex items-center gap-3 text-gray-700">
              <CheckCircle size={18} className="text-green-500 shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Who it's for */}
      <div className="mb-12 grid md:grid-cols-3 gap-6">
        {[
          { role: 'Students',  desc: 'Get explanations, practice exam questions, and track your weak subjects.' },
          { role: 'Parents',   desc: 'Monitor your child\'s progress and get weekly performance summaries.' },
          { role: 'Teachers',  desc: 'Generate practice sets, get class-wide analytics, and save prep time.' },
        ].map(r => (
          <div key={r.role} className="border border-gray-100 rounded-2xl p-6">
            <h3 className="font-semibold text-gray-900 mb-2">{r.role}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{r.desc}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Link to="/pricing" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors">
          See pricing <ArrowRight size={16} />
        </Link>
        <Link to="/contact" className="px-6 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors">
          Contact us
        </Link>
      </div>
    </div>
  )
}
