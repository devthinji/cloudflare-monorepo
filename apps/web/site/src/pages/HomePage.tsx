import { Link } from 'react-router-dom'
import { ArrowRight, FileText, GraduationCap, MessageCircle } from 'lucide-react'

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-5 pt-24 pb-20 text-center">
        <span className="inline-block mb-4 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold uppercase tracking-wider">
          AI Agents for Kenya
        </span>
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 mb-6 leading-tight">
          Your career and education,<br />powered by AI
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10">
          Taji helps you craft professional CVs and letters via WhatsApp. Elim tutors Kenyan students through CBC exams — right from their phone.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/taji" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors">
            Get started with Taji <ArrowRight size={16} />
          </Link>
          <Link to="/elim" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors">
            Explore Elim
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-5xl mx-auto px-5 grid md:grid-cols-3 gap-8">
          {[
            {
              icon: <FileText className="text-blue-600" size={28} />,
              title: 'Professional Documents',
              desc:  'CVs, application letters, and resignation letters — generated in minutes via WhatsApp.',
            },
            {
              icon: <GraduationCap className="text-blue-600" size={28} />,
              title: 'CBC Tutoring',
              desc:  'Elim helps Kenyan students ace their exams with step-by-step guidance and past paper practice.',
            },
            {
              icon: <MessageCircle className="text-blue-600" size={28} />,
              title: 'Works on WhatsApp',
              desc:  'No app to download. Chat naturally with Taji or Elim directly from WhatsApp, Telegram, or SMS.',
            },
          ].map(f => (
            <div key={f.title} className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="mb-4">{f.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-5 py-24 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to get started?</h2>
        <p className="text-gray-500 mb-8">Choose the agent that fits your needs.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/taji"    className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors">Meet Taji</Link>
          <Link to="/elim"    className="px-6 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors">Meet Elim</Link>
          <Link to="/pricing" className="px-6 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors">See Pricing</Link>
        </div>
      </section>
    </div>
  )
}
