import { useState } from 'react'
import { FileText, Download, Search } from 'lucide-react'

interface Doc {
  id:        string
  userId:    string
  type:      string
  title:     string
  fileUrl:   string
  createdAt: string
}

const MOCK: Doc[] = [
  { id: 'd1', userId: '+254712345678', type: 'cv',                   title: 'CV — John Mwangi',       fileUrl: '#', createdAt: 'Today, 09:14'    },
  { id: 'd2', userId: '+254798765432', type: 'application_letter',   title: 'Application — Jane Auma', fileUrl: '#', createdAt: 'Today, 08:22'    },
  { id: 'd3', userId: '+254711223344', type: 'resignation_letter',   title: 'Resignation — Peter K',   fileUrl: '#', createdAt: 'Yesterday'       },
  { id: 'd4', userId: '+254733445566', type: 'cover_letter',         title: 'Cover — Mary Njeri',      fileUrl: '#', createdAt: '22 May'          },
  { id: 'd5', userId: '+254722334455', type: 'cv',                   title: 'CV — David Ochieng',      fileUrl: '#', createdAt: '21 May'          },
]

const TYPE_COLORS: Record<string, string> = {
  cv:                 'bg-blue-50 text-blue-600',
  application_letter: 'bg-purple-50 text-purple-600',
  resignation_letter: 'bg-orange-50 text-orange-500',
  cover_letter:       'bg-teal-50 text-teal-600',
}

const TYPE_LABELS: Record<string, string> = {
  cv:                 'CV',
  application_letter: 'Application',
  resignation_letter: 'Resignation',
  cover_letter:       'Cover Letter',
}

export default function DocumentsPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const filtered = MOCK.filter(d => {
    const matchType   = typeFilter === 'all' || d.type === typeFilter
    const matchSearch = d.title.toLowerCase().includes(search.toLowerCase()) || d.userId.includes(search)
    return matchType && matchSearch
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="text-sm text-gray-500 mt-1">{MOCK.length} documents generated</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
          {(['all', 'cv', 'application_letter', 'resignation_letter', 'cover_letter'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                typeFilter === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'all' ? 'All' : TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(doc => (
          <div key={doc.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-gray-50 rounded-lg">
                <FileText size={18} className="text-gray-500" />
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${TYPE_COLORS[doc.type]}`}>
                {TYPE_LABELS[doc.type]}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1 truncate">{doc.title}</h3>
            <p className="text-xs text-gray-400 font-mono mb-4">{doc.userId}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{doc.createdAt}</span>
              <a
                href={doc.fileUrl}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                onClick={e => e.preventDefault()}
              >
                <Download size={12} /> Download
              </a>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-16 text-center text-gray-400">
          <FileText size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No documents found</p>
        </div>
      )}
    </div>
  )
}
