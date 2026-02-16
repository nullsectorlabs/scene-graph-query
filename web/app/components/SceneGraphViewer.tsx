'use client'

import { useEffect, useRef, useState } from 'react'

interface GraphData {
  objects: Array<{ id: number; class: string; confidence: number }>
  relationships: Array<{ subject: string; predicate: string; object: string }>
}

interface Props {
  data: GraphData | null
}

export default function SceneGraphViewer({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Clear container first
    containerRef.current.innerHTML = ''

    if (!data || !data.objects || data.objects.length === 0) {
      return
    }

    let cytoscape: any = null

    const initGraph = async () => {
      try {
        // Dynamic import to avoid SSR issues
        const cytoscapeModule = await import('cytoscape')
        cytoscape = cytoscapeModule.default

        if (!containerRef.current) return

        // Color mapping
        const colors: Record<string, string> = {
          person: '#00d4ff',
          car: '#a855f7',
          truck: '#a855f7',
          bus: '#a855f7',
          'cell phone': '#f59e0b',
          backpack: '#ec4899',
          default: '#6b7280',
        }

        // Build elements
        const elements: any[] = []
        const idMap = new Map<string, string>()

        // Add nodes
        data.objects.forEach((obj, idx) => {
          const nodeId = `n${obj.id}`
          idMap.set(obj.class, nodeId)
          
          elements.push({
            data: {
              id: nodeId,
              label: `${obj.class}\n${Math.round(obj.confidence * 100)}%`,
              color: colors[obj.class] || colors.default,
            },
          })
        })

        // Add edges
        data.relationships?.forEach((rel, idx) => {
          const source = idMap.get(rel.subject) || `n${rel.subject}`
          const target = idMap.get(rel.object) || `n${rel.object}`
          
          elements.push({
            data: {
              id: `e${idx}`,
              source,
              target,
              label: rel.predicate,
            },
          })
        })

        // Create graph
        const cy = cytoscape({
          container: containerRef.current,
          elements,
          style: [
            {
              selector: 'node',
              style: {
                'background-color': 'data(color)',
                'label': 'data(label)',
                'color': '#fff',
                'font-size': '9px',
                'text-valign': 'center',
                'width': 50,
                'height': 50,
                'border-width': 2,
                'border-color': '#fff',
                'text-wrap': 'wrap',
                'text-max-width': '60px',
              },
            },
            {
              selector: 'edge',
              style: {
                'width': 2,
                'line-color': '#00d4ff',
                'target-arrow-color': '#00d4ff',
                'target-arrow-shape': 'triangle',
                'curve-style': 'bezier',
                'label': 'data(label)',
                'font-size': '8px',
                'color': '#00d4ff',
                'text-rotation': 'autorotate',
              },
            },
          ],
          layout: {
            name: 'circle',
            animate: true,
            padding: 20,
          },
          userPanningEnabled: true,
          boxSelectionEnabled: false,
          autounselectify: true,
          wheelSensitivity: 0.3,
        })

        // Store for cleanup
        ;(containerRef.current as any).__cy = cy

      } catch (err) {
        console.error('Graph error:', err)
        setError('Could not render graph')
      }
    }

    initGraph()

    // Cleanup
    return () => {
      try {
        if ((containerRef.current as any).__cy) {
          (containerRef.current as any).__cy.destroy()
        }
      } catch (e) {}
    }
  }, [data])

  if (!data || !data.objects?.length) {
    return (
      <div className="bg-dark-900 rounded-xl h-64 flex items-center justify-center border border-dark-700">
        <p className="text-gray-500 text-sm">No data to visualize</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-dark-900 rounded-xl h-64 flex items-center justify-center border border-dark-700">
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef} 
      className="bg-dark-900 rounded-xl h-80 border border-dark-700 overflow-hidden"
      style={{ minHeight: '320px' }}
    />
  )
}
