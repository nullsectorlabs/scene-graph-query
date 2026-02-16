'use client'

import { useEffect, useRef } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
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
  const graphRef = useRef<cytoscape.Core | null>(null)

  if (!data || !data.objects || data.objects.length === 0) {
    return (
      <div className="bg-dark-900 rounded-xl p-4 h-64 flex items-center justify-center border border-dark-700">
        <p className="text-dark-500 text-sm">No graph data available</p>
      </div>
    )
  }

  // Build graph elements
  const elements: cytoscape.ElementDefinition[] = []
  
  // Add nodes for objects
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
    default: '#6b7280',
  }

  const addedNodes = new Set<string>()
  data.objects.forEach((obj, idx) => {
    const nodeId = `node_${obj.id}`
    if (!addedNodes.has(nodeId)) {
      addedNodes.add(nodeId)
      elements.push({
        data: {
          id: nodeId,
          label: `${obj.class} (${(obj.confidence * 100).toFixed(0)}%)`,
          color: nodeColors[obj.class] || nodeColors.default,
        },
      })
    }
  })

  // Add edges for relationships
  const subjectToNodeId = new Map<string, string>()
  data.objects.forEach((obj) => {
    const nodeId = `node_${obj.id}`
    if (!subjectToNodeId.has(obj.class)) {
      subjectToNodeId.set(obj.class, nodeId)
    }
  })

  data.relationships?.forEach((rel, idx) => {
    const sourceId = subjectToNodeId.get(rel.subject) || `node_${rel.subject}`
    const targetId = subjectToNodeId.get(rel.object) || `node_${rel.object}`
    
    elements.push({
      data: {
        id: `edge_${idx}`,
        source: sourceId,
        target: targetId,
        label: rel.predicate,
      },
    })
  })

  const styleSheet: cytoscape.Stylesheet[] = [
    {
      selector: 'node',
      style: {
        'background-color': 'data(color)',
        'label': 'data(label)',
        'color': '#fff',
        'font-size': '12px',
        'text-valign': 'bottom',
        'text-margin-y': 5,
        'width': 50,
        'height': 50,
        'border-width': 2,
        'border-color': '#fff',
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
        'font-size': '10px',
        'color': '#00d4ff',
        'text-rotation': 'autorotate',
        'text-margin-y': -10,
      },
    },
  ]

  return (
    <div className="bg-dark-900 rounded-xl h-80 border border-dark-700 overflow-hidden">
      <CytoscapeComponent
        elements={elements}
        style={{ width: '100%', height: '100%' }}
        stylesheet={styleSheet}
        layout={{
          name: 'cose',
          animate: true,
          padding: 10,
          nodeRepulsion: 8000,
          idealEdgeLength: 100,
        }}
        cy={(cy) => {
          graphRef.current = cy
        }}
      />
    </div>
  )
}
