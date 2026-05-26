import { Link } from 'react-router-dom'
import { FileText, CheckCircle, ArrowRight } from 'lucide-react'

const FEATURES = [
  'Professional CV in under 5 minutes',
  'Application letters tailored to job descriptions',
  'Resignation letters — professional, no awkwardness',
  'Works entirely via WhatsApp — no app needed',
  'Pay via M-Pesa — fast and local',
]

export default function TajiPage() {
  return (
    <div className="max-w-4xl mx-auto px-5 py-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
          <FileText className="text-blue-600" size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Taji</h1>
          <p className="text-gray-500 text-sm">Career document agent</p>
        </div>
      </div>

      <p className="text-lg text-gray-600 mb-12 leading-relaxed max-w-2xl">
        Taji is an AI agent that helps Kenyans create professional career documents via WhatsApp. No expensive CV writers, no formatting headaches — just a conversation.
      </p>

      {/* Features */}
      <div className="bg-gray-50 rounded-2xl p-8 mb-12">
        <h2 className="font-semibold text-gray-900 mb-5 text-lg">What Taji can do</h2>
        <ul className="space-y-3">
          {FEATURES.map(f => (
            <li key={f} className="flex items-center gap-3 text-gray-700">
              <CheckCircle size={18} className="text-blue-500 shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* How it works */}
      <div className="mb-12">
        <h2 className="font-semibold text-gray-900 mb-6 text-lg">How it works</h2>
        <ol className="space-y-4">
          {[
            { step: '1', title: 'Start a chat',    desc: 'Message Taji on WhatsApp or Telegram.' },
            { step: '2', title: 'Answer questions', desc: 'Taji asks you about your experience, skills, and the role you\'re applying for.' },
            { step: '3', title: 'Get your document', desc: 'Receive a professionally formatted document in minutes.' },
            { step: '4', title: 'Pay via M-Pesa',  desc: 'Simple, local payment — no cards needed.' },
          ].map(s => (
            <div key={s.step} className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                {s.step}
              </div>
              <div>
                <p className="font-medium text-gray-900">{s.title}</p>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            </div>
          ))}
        </ol>
      </div>

      <div className="flex gap-3">
        <Link to="/pricing"  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors">
          See pricing <ArrowRight size={16} />
        </Link>
        <Link to="/contact"  className="px-6 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors">
          Contact us
        </Link>
      </div>
    </div>
  )
}
