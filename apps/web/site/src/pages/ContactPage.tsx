import { Mail, MessageCircle, Phone } from 'lucide-react'

export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-20">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Get in touch</h1>
      <p className="text-gray-500 mb-12">We're a small team. We respond fast.</p>

      <div className="grid md:grid-cols-3 gap-6 mb-14">
        {[
          { icon: <MessageCircle size={22} className="text-blue-600" />, label: 'WhatsApp', value: '+254 700 000 000' },
          { icon: <Mail size={22} className="text-blue-600" />,         label: 'Email',    value: 'hello@taji.co.ke' },
          { icon: <Phone size={22} className="text-blue-600" />,        label: 'Call',     value: '+254 700 000 000' },
        ].map(c => (
          <div key={c.label} className="bg-gray-50 rounded-2xl p-6 flex flex-col gap-3">
            {c.icon}
            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">{c.label}</p>
            <p className="text-gray-800 font-semibold">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Contact form */}
      <form className="space-y-5" onSubmit={e => e.preventDefault()}>
        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
            <input type="text" placeholder="Your name" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-200 transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input type="email" placeholder="you@example.com" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-200 transition" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
          <input type="text" placeholder="How can we help?" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-200 transition" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
          <textarea rows={5} placeholder="Tell us more..." className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-200 transition resize-none" />
        </div>
        <button type="submit" className="px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
          Send message
        </button>
      </form>
    </div>
  )
}
