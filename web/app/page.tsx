'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { FaUpload, FaBrain, FaChartLine, FaShieldAlt, FaShoppingCart, FaCar, FaUsers } from 'react-icons/fa'
import SceneGraphViewer from './components/SceneGraphViewer'

// Demo configs with ACTUAL YOLO26 analyzed results
const DEMOS = [
  { 
    id: 1, label: 'Security', icon: FaShieldAlt, 
    image: '/security.jpg',
    objects: [
      { id: 1, class: 'person', confidence: 0.64 },
      { id: 2, class: 'person', confidence: 0.28 },
      { id: 3, class: 'person', confidence: 0.26 },
    ],
    relationships: [
      { subject: 'person', predicate: 'near', object: 'person' },
      { subject: 'person', predicate: 'near', object: 'person' },
    ]
  },
  { 
    id: 2, label: 'Retail', icon: FaShoppingCart, 
    image: '/crowd.jpg',
    objects: [
      { id: 1, class: 'person', confidence: 0.88 },
      { id: 2, class: 'person', confidence: 0.68 },
      { id: 3, class: 'person', confidence: 0.57 },
      { id: 4, class: 'person', confidence: 0.53 },
    ],
    relationships: [
      { subject: 'person', predicate: 'near', object: 'person' },
    ]
  },
  { 
    id: 3, label: 'Traffic', icon: FaCar, 
    image: '/traffic.jpg',
    objects: [
      { id: 1, class: 'car', confidence: 0.95 },
    ],
    relationships: []
  },
  { 
    id: 4, label: 'Crowd', icon: FaUsers, 
    image: '/crowd.jpg',
    objects: [
      { id: 1, class: 'person', confidence: 0.88 },
      { id: 2, class: 'person', confidence: 0.68 },
      { id: 3, class: 'person', confidence: 0.57 },
      { id: 4, class: 'person', confidence: 0.53 },
      { id: 5, class: 'person', confidence: 0.47 },
    ],
    relationships: [
      { subject: 'person', predicate: 'near', object: 'person' },
    ]
  },
]

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<{objects: any[]; relationships: any[]} | null>(null)
  const [activeDemo, setActiveDemo] = useState(1)
  const [showAnnotated, setShowAnnotated] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0]
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResult(null)
    setShowAnnotated(false)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1
  })

  const runDemo = (demoId: number) => {
    const demo = DEMOS.find(d => d.id === demoId)
    if (!demo) return
    
    setActiveDemo(demoId)
    setFile(null)
    setPreview(demo.image)
    setShowAnnotated(true) // Show annotated version for demos
    setResult({ objects: demo.objects, relationships: demo.relationships })
  }

  const analyzeImage = async () => {
    if (!file) return
    setIsAnalyzing(true)
    
    try {
      const arrayBuffer = await file.arrayBuffer()
      const base64 = btoa(new Uint8Array(arrayBuffer).reduce((d, b) => d + String.fromCharCode(b), ''))
      
      const response = await fetch('http://localhost:7861/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, query: query || 'list all objects' })
      })
      
      const data = await response.json()
      
      if (data.success && data.objects) {
        setResult({ objects: data.objects, relationships: data.relationships || [] })
        setShowAnnotated(false)
      } else {
        alert('Analysis failed: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to analyze image')
    }
    
    setIsAnalyzing(false)
  }

  useEffect(() => { runDemo(1) }, [])

  // Get current demo for image
  const currentDemo = DEMOS.find(d => d.id === activeDemo)
  const displayImage = preview || currentDemo?.image || '/security.jpg'
  const useAnnotated = showAnnotated && activeDemo > 0

  return (
    <div className="min-h-screen bg-dark-950 text-white">
      <header className="border-b border-dark-800 bg-dark-900/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
              <FaBrain className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Scene Graph Query</h1>
              <p className="text-xs text-gray-500">YOLO26 Powered</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            System Online
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Demo Buttons */}
        <div className="flex gap-3 mb-8">
          {DEMOS.map((demo) => (
            <button
              key={demo.id}
              onClick={() => runDemo(demo.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeDemo === demo.id
                  ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-400'
                  : 'bg-dark-800 border border-dark-700 hover:border-dark-600'
              }`}
            >
              <demo.icon />
              {demo.label}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left: Image */}
          <div className="space-y-4">
            <div className="aspect-video bg-dark-900 rounded-xl overflow-hidden border border-dark-700 relative">
              <img 
                src={displayImage} 
                alt="Preview" 
                className="w-full h-full object-cover" 
              />
              {useAnnotated && (
                <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-cyan-400">
                  🔍 YOLO26 Detection
                </div>
              )}
            </div>

            <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${isDragActive ? 'border-cyan-500 bg-cyan-500/10' : 'border-dark-700 hover:border-dark-600'}`}>
              <input {...getInputProps()} />
              <FaUpload className="mx-auto mb-2 text-2xl text-gray-500" />
              <p className="text-gray-400">Drop image here or click to upload</p>
            </div>

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Query: "find all people"'
              className="w-full bg-dark-900 border border-dark-700 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />

            <button
              onClick={analyzeImage}
              disabled={!file || isAnalyzing}
              className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isAnalyzing ? <FaChartLine className="animate-spin" /> : <FaBrain />}
              {isAnalyzing ? 'Analyzing...' : 'Analyze with YOLO26'}
            </button>
          </div>

          {/* Right: Results */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FaChartLine className="text-cyan-400" />
              Analysis Results
            </h3>

            {result && result.objects ? (
              <div className="space-y-4">
                {/* Objects with confidence */}
                <div className="bg-dark-900 rounded-xl p-4 border border-dark-700">
                  <h4 className="text-sm font-medium text-gray-400 mb-3">
                    🔍 Detected Objects ({result.objects.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {result.objects.map((obj: any, idx: number) => (
                      <div key={idx} className="bg-dark-800 rounded-lg px-3 py-2 flex flex-col">
                        <span className="text-sm text-cyan-400 font-medium">{obj.class}</span>
                        <span className="text-xs text-gray-500">{Math.round(obj.confidence * 100)}% conf</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Graph */}
                <div className="bg-dark-900 rounded-xl p-4 border border-dark-700">
                  <h4 className="text-sm font-medium text-gray-400 mb-3">🕸️ Scene Graph</h4>
                  <SceneGraphViewer data={result} />
                </div>

                {/* Relationships */}
                <div className="bg-dark-900 rounded-xl p-4 border border-dark-700">
                  <h4 className="text-sm font-medium text-gray-400 mb-3">
                    🔗 Relationships ({result.relationships.length})
                  </h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {result.relationships.slice(0, 6).map((rel: any, idx: number) => (
                      <div key={idx} className="bg-dark-800/50 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                        <span className="text-purple-400">{rel.subject}</span>
                        <span className="text-gray-500">→</span>
                        <span className="text-cyan-400">{rel.predicate}</span>
                        <span className="text-gray-500">→</span>
                        <span className="text-pink-400">{rel.object}</span>
                      </div>
                    ))}
                    {result.relationships.length === 0 && (
                      <p className="text-gray-500 text-sm">No relationships detected</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-dark-900 rounded-xl p-8 border border-dark-700 text-center text-gray-500">
                <FaChartLine className="text-4xl mx-auto mb-2 opacity-50" />
                <p>Upload an image or select a demo</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
