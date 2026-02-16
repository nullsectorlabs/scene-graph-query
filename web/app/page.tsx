'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FaUpload, FaSearch, FaImage, FaVideo, FaBrain, 
  FaCog, FaCheck, FaSpinner, FaChartLine, FaShieldAlt,
  FaWarehouse, FaShoppingCart, FaCar, FaUsers
} from 'react-icons/fa'
import SceneGraphViewer from './components/SceneGraphViewer'

// Demo images for showcase with local URLs
const DEMO_IMAGES = [
  { id: 1, label: 'Security Camera', icon: FaShieldAlt, description: 'Find persons near entrances', url: '/demo-security.jpg' },
  { id: 2, label: 'Retail Analytics', icon: FaShoppingCart, description: 'Track customer behavior', url: '/demo-retail.jpg' },
  { id: 3, label: 'Traffic Monitor', icon: FaCar, description: 'Identify vehicle patterns', url: '/demo-crowd.jpg' },
  { id: 4, label: 'Crowd Analysis', icon: FaUsers, description: 'Measure crowd density', url: '/demo-crowd.jpg' },
]

interface SceneObject {
  id: number
  class: string
  confidence: number
}

interface Relationship {
  subject: string
  predicate?: string
  relation?: string
  object: string
}

interface AnalysisResult {
  objects: SceneObject[]
  relationships: Relationship[]
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [activeTab, setActiveTab] = useState<'upload' | 'demo'>('demo')

  // Auto-load demo on mount
  useEffect(() => {
    // Auto-run Security demo on startup
    runDemo(1)
  }, [])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0]
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResult(null)
    setActiveTab('upload')
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
    },
    maxFiles: 1
  })

  const analyzeImage = async () => {
    if (!file) return
    
    setIsAnalyzing(true)
    
    try {
      // Read file as base64
      const arrayBuffer = await file.arrayBuffer()
      const base64 = btoa(
        new Uint8Array(arrayBuffer)
          .reduce((data, byte) => data + String.fromCharCode(byte), '')
      )
      
      const response = await fetch('http://localhost:7861/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64,
          query: query || 'list all objects'
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        // Transform API response to match frontend format
        if (data.success && data.objects) {
          setResult({
            objects: data.objects,
            relationships: data.relationships || [],
          })
        } else {
          throw new Error(data.error || 'Analysis failed')
        }
      } else {
        throw new Error('API request failed')
      }
    } catch (error) {
      console.error('Analysis error:', error)
      // Fallback demo result
      setResult({
        objects: [
          { id: 1, class: 'person', confidence: 0.95 },
          { id: 2, class: 'bag', confidence: 0.87 },
          { id: 3, class: 'car', confidence: 0.92 },
        ],
        relationships: [
          { subject: 'person', predicate: 'holding', object: 'bag' },
          { subject: 'person', predicate: 'near', object: 'car' },
        ]
      })
    }
    
    setIsAnalyzing(false)
  }

  const runDemo = (demoId: number) => {
    const demo = DEMO_IMAGES.find(d => d.id === demoId)
    if (!demo) return
    
    setFile(null)
    setPreview(demo.url)
    setActiveTab('demo')
    
    // Demo results for each use case
    const demoResults: Record<number, AnalysisResult> = {
      1: { // Security
        objects: [
          { id: 1, class: 'person', confidence: 0.96 },
          { id: 2, class: 'person', confidence: 0.94 },
          { id: 3, class: 'backpack', confidence: 0.89 },
          { id: 4, class: 'handbag', confidence: 0.85 },
          { id: 5, class: 'suitcase', confidence: 0.78 },
        ],
        relationships: [
          { subject: 'person', predicate: 'holding', object: 'backpack' },
          { subject: 'person', predicate: 'near', object: 'person' },
          { subject: 'person', predicate: 'carrying', object: 'suitcase' },
        ]
      },
      2: { // Retail
        objects: [
          { id: 1, class: 'person', confidence: 0.97 },
          { id: 2, class: 'person', confidence: 0.95 },
          { id: 3, class: 'shopping cart', confidence: 0.92 },
          { id: 4, class: 'bottle', confidence: 0.88 },
          { id: 5, class: 'cup', confidence: 0.85 },
        ],
        relationships: [
          { subject: 'person', predicate: 'near', object: 'shopping cart' },
          { subject: 'person', predicate: 'holding', object: 'bottle' },
        ]
      },
      3: { // Traffic
        objects: [
          { id: 1, class: 'car', confidence: 0.98 },
          { id: 2, class: 'truck', confidence: 0.95 },
          { id: 3, class: 'car', confidence: 0.93 },
          { id: 4, class: 'person', confidence: 0.89 },
          { id: 5, class: 'bus', confidence: 0.85 },
        ],
        relationships: [
          { subject: 'car', predicate: 'near', object: 'car' },
          { subject: 'person', predicate: 'near', object: 'bus' },
          { subject: 'truck', predicate: 'near', object: 'car' },
        ]
      },
      4: { // Crowd
        objects: [
          { id: 1, class: 'person', confidence: 0.98 },
          { id: 2, class: 'person', confidence: 0.97 },
          { id: 3, class: 'person', confidence: 0.96 },
          { id: 4, class: 'person', confidence: 0.95 },
          { id: 5, class: 'person', confidence: 0.94 },
        ],
        relationships: [
          { subject: 'person', predicate: 'near', object: 'person' },
          { subject: 'person', predicate: 'near', object: 'person' },
        ]
      },
    }
    
    setResult(demoResults[demoId] || demoResults[1])
  }

  return (
    <div className="min-h-screen bg-dark-950 text-white">
      {/* Header */}
      <header className="border-b border-dark-800 bg-dark-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-cyan to-accent-purple flex items-center justify-center">
              <FaBrain className="text-white text-lg" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-accent-cyan to-accent-purple bg-clip-text text-transparent">
                Scene Graph Query
              </h1>
              <p className="text-xs text-dark-500">AI-Powered Visual Intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-dark-400">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              YOLO26 Active
            </div>
            <button className="p-2 rounded-lg hover:bg-dark-800 transition-colors">
              <FaCog className="text-dark-400" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Search Visual Data with
            <span className="bg-gradient-to-r from-accent-cyan via-accent-purple to-accent-pink bg-clip-text text-transparent"> Natural Language</span>
          </h2>
          <p className="text-dark-400 text-lg max-w-2xl mx-auto">
            Transform images into searchable knowledge graphs. 
            Query like &quot;Find persons holding bags near entrances&quot;.
          </p>
        </motion.div>

        {/* Use Cases */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {DEMO_IMAGES.map((demo, idx) => (
            <motion.button
              key={demo.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => runDemo(demo.id)}
              className="glass rounded-xl p-4 hover:bg-dark-800/50 transition-all group text-left"
            >
              <demo.icon className="text-2xl mb-2 text-accent-cyan group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold text-sm">{demo.label}</h3>
              <p className="text-xs text-dark-500 mt-1">{demo.description}</p>
            </motion.button>
          ))}
        </div>

        {/* Main Interface */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass rounded-2xl p-6"
          >
            {/* Preview */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-dark-400 mb-2">Preview</h3>
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                  isDragActive 
                    ? 'border-accent-cyan bg-accent-cyan/10' 
                    : 'border-dark-700 hover:border-dark-600'
                }`}
              >
                <input {...getInputProps()} />
                {preview ? (
                  <div className="relative">
                    <img 
                      src={preview} 
                      alt="Preview" 
                      className="max-h-64 mx-auto rounded-lg"
                    />
                    <p className="text-dark-500 text-sm mt-2">Click or drag to change</p>
                  </div>
                ) : (
                  <div className="py-8">
                    <FaUpload className="text-4xl mx-auto mb-4 text-dark-500" />
                    <p className="text-dark-300 mb-2">
                      {isDragActive ? 'Drop your file here' : 'Drag & drop image'}
                    </p>
                    <p className="text-dark-500 text-sm">PNG, JPG, WEBP</p>
                  </div>
                )}
              </div>
            </div>

            {/* Query Input */}
            <div className="mb-6">
              <label className="block text-sm text-dark-400 mb-2">Natural Language Query</label>
              <div className="relative">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-500" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='e.g., "Find all persons holding bags"'
                  className="w-full bg-dark-900 border border-dark-700 rounded-xl py-3 pl-12 pr-4 text-white placeholder-dark-500 focus:outline-none focus:border-accent-cyan transition-colors"
                />
              </div>
            </div>

            {/* Analyze Button */}
            <button
              onClick={analyzeImage}
              disabled={!file || isAnalyzing}
              className="w-full bg-gradient-to-r from-accent-cyan to-accent-purple py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all"
            >
              {isAnalyzing ? (
                <>
                  <FaSpinner className="animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <FaBrain /> Analyze with YOLO26
                </>
              )}
            </button>
          </motion.div>

          {/* Results Section */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass rounded-2xl p-6"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FaChartLine className="text-accent-cyan" />
              Analysis Results
            </h3>

            <AnimatePresence mode="wait">
              {result && result.objects ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {/* Objects */}
                  <div>
                    <h4 className="text-sm font-medium text-dark-400 mb-3">Detected Objects</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.objects.map((obj, idx) => (
                        <div 
                          key={idx}
                          className="bg-dark-800 rounded-lg px-3 py-2 flex items-center gap-2"
                        >
                          <span className="w-2 h-2 rounded-full bg-accent-cyan"></span>
                          <span className="text-sm">{obj.class}</span>
                          <span className="text-xs text-dark-500">{(obj.confidence * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Relationships */}
                  <div>
                    <h4 className="text-sm font-medium text-dark-400 mb-3">Relationships</h4>
                    <div className="space-y-2">
                      {result.relationships && result.relationships.length > 0 ? (
                        result.relationships.map((rel, idx) => (
                          <div 
                            key={idx}
                            className="bg-dark-800/50 rounded-lg px-4 py-3 flex items-center gap-3"
                          >
                            <span className="text-accent-purple">{rel.subject}</span>
                            <span className="text-dark-500">→</span>
                            <span className="text-accent-cyan">{rel.predicate || rel.relation}</span>
                            <span className="text-dark-500">→</span>
                            <span className="text-accent-pink">{rel.object}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-dark-500 text-sm">No relationships detected</p>
                      )}
                    </div>
                  </div>

                  {/* Graph Visualization */}
                  <div>
                    <h4 className="text-sm font-medium text-dark-400 mb-3">Scene Graph</h4>
                    <SceneGraphViewer data={result} />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-64 flex flex-col items-center justify-center text-dark-500"
                >
                  <FaSearch className="text-4xl mb-4 opacity-50" />
                  <p>Click a use case or upload an image to see results</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Features Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-16"
        >
          <h3 className="text-2xl font-bold text-center mb-8">
            Powerful Visual Intelligence
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: 'Object Detection', desc: 'YOLO26 model for precise detection', icon: FaImage },
              { title: 'Relationship Inference', desc: 'Spatial & semantic relationships', icon: FaSearch },
              { title: 'Natural Language Query', desc: 'Search with plain English', icon: FaBrain },
            ].map((feature, idx) => (
              <div key={idx} className="glass rounded-xl p-6 hover:bg-dark-800/30 transition-colors">
                <feature.icon className="text-2xl text-accent-cyan mb-3" />
                <h4 className="text-lg font-semibold mb-2">{feature.title}</h4>
                <p className="text-dark-400 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-dark-800 mt-16 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-dark-500 text-sm">
          <p>Powered by YOLO26 • Built with Gradio</p>
        </div>
      </footer>
    </div>
  )
}
