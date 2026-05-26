import { Link } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'

const TAJI_PLANS = [
  { name: 'CV',           price: 'KES 199', features: ['Professional CV', 'DOCX + PDF', '1 revision'] },
  { name: 'Letter',       price: 'KES 99',  features: ['Application or resignation letter', 'Tailored to job description'] },
  { name: 'Bundle',       price: 'KES 249', features: ['CV + Application letter', 'DOCX + PDF', '2 revisions'], highlight: true },
]

const ELIM_PLANS = [
  { name: 'Student',      price: 'KES 149/mo', features: ['Unlimited questions', 'Past paper practice', 'Progress tracking'] },
  { name: 'Family',       price: 'KES 299/mo', features: ['Up to 3 students', 'Parent dashboard', 'Weekly reports'], highlight: true },
  { name: 'Institution',  price: 'Custom',      features: ['Class-wide analytics', 'Teacher tools', 'Bulk billing'] },
]

function PlanCard({ plan }: { plan: { name: string; price: string; features: string[]; highlight?: boolean } }) {
  return (
    <div className={`rounded-2xl p-7 border ${plan.highlight ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
      <h3 className="font-bold text-gray-900 text-lg mb-1">{plan.name}</h3>
      <p className={`text-2xl font-extrabold mb-6 ${plan.highlight ? 'text-blue-600' : 'text-gray-900'}`}>{plan.price}</p>
      <ul className="space-y-2.5 mb-8">
        {plan.features.map(f => (
          <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
            <CheckCircle size={15} className={plan.highlight ? 'text-blue-500' : 'text-gray-400'} />
            {f}
          </li>
        ))}
      </ul>
      <Link
        to="/contact"
        className={`block text-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
          plan.highlight
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
        }`}
      >
        Get started
      </Link>
    </div>
  )
}

export default function PricingPage() {
  return (
    <div className="max-w-5xl mx-auto px-5 py-20">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Simple, local pricing</h1>
        <p className="text-gray-500 max-w-xl mx-auto">Pay via M-Pesa. No cards, no subscriptions unless you want them. Cancel any time.</p>
      </div>

      <div className="mb-14">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Taji — Career documents</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {TAJI_PLANS.map(p => <PlanCard key={p.name} plan={p} />)}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-6">Elim — CBC tutoring</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {ELIM_PLANS.map(p => <PlanCard key={p.name} plan={p} />)}
        </div>
      </div>
    </div>
  )
}
