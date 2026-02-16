'use client'

import { useEffect, useRef, useState } from 'react'
import cytoscape from 'cytoscape'

interface GraphData {
  objects: Array<{
    id: number
    class: string
    confidence: number
  }>
  relationships: Array<{
    subject: string
    predicate: string
    object: string
  }>
}

interface SceneGraphViewerProps {
  data: GraphData | null
}

export default function SceneGraphViewer({ data }: SceneGraphViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Cleanup previous instance
    if (cyRef.current) {
      cyRef.current.destroy()
      cyRef.current = null
    }

    if (!data || !data.objects || data.objects.length === 0) {
      return
    }

    if (!containerRef.current) {
      return
    }

    try {
      setError(null)

      // Build graph elements
      const elements: cytoscape.ElementDefinition[] = []
      
      // Color mapping for different object types
      const nodeColors: Record<string, string> = {
        person: '#00d4ff',
        car: '#a855f7',
        truck: '#a855f7',
        bus: '#a855f7',
        bicycle: '#a855f7',
        motorcycle: '#a855f7',
        bag: '#ec4899',
        backpack: '#ec4899',
        handbag: '#ec4899',
        suitcase: '#ec4899',
        cup: '#22c55e',
        bottle: '#22c55e',
        phone: '#f59e0b',
        'cell phone': '#f59e0b',
        default: '#6b7280',
      }

      // Add nodes
      const classToId = new Map<string, string>()
      data.objects.forEach((obj, idx) => {
        const nodeId = `node_${obj.id}`
        classToId.set(obj.class, nodeId)
        
        elements.push({
          data: {
            id: nodeId,
            label: `${obj.class}\n${(obj.confidence * 100).toFixed(0)}%`,
            color: nodeColors[obj.class] || nodeColors.default,
          },
        })
      })

      // Add edges for relationships
      data.relationships?.forEach((rel, idx) => {
        const sourceId = classToId.get(rel.subject) || `node_${rel.subject}`
        const targetId = classToId.get(rel.object) || `node_${rel.object}`
        
        if (sourceId && targetId) {
          elements.push({
            data: {
              id: `edge_${idx}`,
              source: sourceId,
              target: targetId,
              label: rel.predicate || 'related',
            },
          })
        }
      })

      // Create cytoscape instance
      const cy = cytoscape({
        container: containerRef.current,
        elements: elements,
        style: [
          {
            selector: 'node',
            style: {
              'background-color': 'data(color)',
              'label': 'data(label)',
              'color': '#fff',
              'font-size': '10px',
              'text-valign': 'center',
              'text-halign': 'center',
              'width': 60,
              'height': 60,
              'border-width': 2,
              'border-color': '#fff',
              'text-wrap': 'wrap',
              'text-max-width': '80px',
            },
          },
          {
            selector: 'edge',
            style: {
              'width': 3,
              'line-color': '#00d4ff',
              'target-arrow-color': '#00d4ff',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              'label': 'data(label)',
              'font-size': '9px',
              'color': '#00d4ff',
              'text-rotation': 'autorotate',
              'text-margin-y': -10,
            },
          },
        ],
        layout: {
          name: 'cose',
          animate: true,
          padding: 20,
          nodeRepulsion: 8000,
          idealEdgeLength: 100,
          gravity: 0.5,
        },
        wheelSensitivity: 0.3,
      })

      cyRef.current = cy

      cy.on('error', (evt) => {
        console.error('Cytoscape error:', evt)
        setError('Graph rendering error')
      })

    } catch (err) {
      console.error('Graph error:', err)
      setError('Failed to render graph')
    }

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy()
        cyRef.current = null
      }
    }
  }, [data])

  if (!data || !data.objects || data.objects.length === 0) {
    return (
      <div className="bg-dark-900 rounded-xl p-4 h-64 flex items-center justify-center border border-dark-700">
        <p className="text-dark-500 text-sm">No graph data available</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-dark-900 rounded-xl p-4 h-64 flex items-center justify-center border border-dark-700">
        <p className="text-dark-500 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-dark-900 rounded-xl h-80 border border-dark-700 overflow-hidden">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
