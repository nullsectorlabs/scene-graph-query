#!/usr/bin/env python
"""
Scene Graph Query System
Natural language search over images/video using scene graphs.

Use Case: Video surveillance search, content moderation, retail analytics
"""

import gradio as gr
import torch
from PIL import Image
import numpy as np
from pathlib import Path
import json
from datetime import datetime
import networkx as nx
from typing import Dict, List, Tuple, Optional
import cv2
from collections import defaultdict
import re

# Try importing ultralytics, install if needed
try:
    from ultralytics import YOLO
except ImportError:
    import subprocess
    subprocess.check_call(["pip", "install", "ultralytics", "-q"])
    from ultralytics import YOLO


class SceneGraphExtractor:
    """Extract scene graph from images using YOLO + visual relationships."""
    
    # Common object categories from COCO
    PERSON_KEYS = ["person", "man", "woman", "boy", "girl"]
    VEHICLE_KEYS = ["car", "truck", "bus", "motorcycle", "bicycle"]
    OBJECT_KEYS = ["bag", "backpack", "handbag", "suitcase", "cup", "bottle", "phone"]
    
    # Spatial relationship patterns
    SPATIAL_PREPOSITIONS = {
        "above": ["above", "on top of", "over"],
        "below": ["below", "under", "beneath"],
        "near": ["near", "beside", "next to", "close to"],
        "inside": ["inside", "in", "within"],
        "holding": ["holding", "carrying", "has", "with"],
        "on": ["on", "sitting on", "standing on"],
    }
    
    def __init__(self, model_name: str = "yolov8n.pt"):
        """Initialize with YOLO model."""
        print(f"Loading YOLO model: {model_name}...")
        self.model = YOLO(model_name)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Using device: {self.device}")
        
    def detect_objects(self, image: Image.Image) -> List[Dict]:
        """Detect objects in image."""
        results = self.model(image, verbose=False)
        
        objects = []
        for r in results:
            boxes = r.boxes
            for i, box in enumerate(boxes):
                cls_id = int(box.cls[0])
                cls_name = self.model.names[cls_id]
                conf = float(box.conf[0])
                
                # Get bounding box
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                
                # Calculate center and area
                cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                area = (x2 - x1) * (y2 - y1)
                
                objects.append({
                    "id": i,
                    "class": cls_name,
                    "confidence": conf,
                    "bbox": [float(x1), float(y1), float(x2), float(y2)],
                    "center": [float(cx), float(cy)],
                    "area": float(area),
                })
                
        return objects
    
    def infer_relationships(self, objects: List[Dict], image_shape: Tuple[int, int]) -> List[Dict]:
        """Infer spatial relationships between detected objects."""
        h, w = image_shape[:2]
        relationships = []
        
        for i, obj1 in enumerate(objects):
            for j, obj2 in enumerate(objects):
                if i >= j:
                    continue
                    
                # Calculate spatial relationship
                rel = self._compute_relationship(obj1, obj2, h, w)
                if rel:
                    relationships.append({
                        "subject": obj1["class"],
                        "subject_id": i,
                        "predicate": rel,
                        "object": obj2["class"],
                        "object_id": j,
                    })
                    
        return relationships
    
    def _compute_relationship(self, obj1: Dict, obj2: Dict, img_h: int, img_w: int) -> Optional[str]:
        """Compute spatial relationship between two objects."""
        cx1, cy1 = obj1["center"]
        cx2, cy2 = obj2["center"]
        
        # Normalize positions
        nx1, ny1 = cx1 / img_w, cy1 / img_h
        nx2, ny2 = cx2 / img_w, cy2 / img_h
        
        # Calculate relative positions
        dx = nx2 - nx1
        dy = ny2 - ny1
        
        # Distance
        dist = (dx**2 + dy**2) ** 0.5
        
        # Size ratio
        area1, area2 = obj1["area"], obj2["area"]
        size_ratio = min(area1, area2) / max(area1, area2) if max(area1, area2) > 0 else 0
        
        # Determine relationship
        if dist > 0.8:
            return None  # Too far apart
            
        if dy < -0.1 and abs(dx) < 0.15:
            return "above"
        if dy > 0.1 and abs(dx) < 0.15:
            return "on"
        if dist < 0.25:
            if size_ratio > 0.3:
                return "near"
            else:
                return "holding"
        if abs(dx) < 0.1 and abs(dy) < 0.15:
            return "on"
            
        return "near"
    
    def build_graph(self, objects: List[Dict], relationships: List[Dict]) -> nx.DiGraph:
        """Build NetworkX graph from objects and relationships."""
        G = nx.DiGraph()
        
        # Add nodes
        for obj in objects:
            G.add_node(
                obj["id"],
                class_name=obj["class"],
                confidence=obj["confidence"],
                bbox=obj["bbox"],
                center=obj["center"],
            )
            
        # Add edges
        for rel in relationships:
            G.add_edge(
                rel["subject_id"],
                rel["object_id"],
                predicate=rel["predicate"],
                subject=rel["subject"],
                object=rel["object"],
            )
            
        return G
    
    def process_image(self, image: Image.Image) -> Dict:
        """Process image and return scene graph."""
        # Detect objects
        objects = self.detect_objects(image)
        
        # Infer relationships
        relationships = self.infer_relationships(objects, image.size)
        
        # Build graph
        graph = self.build_graph(objects, relationships)
        
        return {
            "objects": objects,
            "relationships": relationships,
            "graph": graph,
            "num_objects": len(objects),
            "num_relationships": len(relationships),
        }


class GraphQueryEngine:
    """Natural language query over scene graphs."""
    
    def __init__(self, scene_graph_data: Dict):
        self.scene_graph = scene_graph_data["graph"]
        self.objects = scene_graph_data["objects"]
        self.relationships = scene_graph_data["relationships"]
        
    def query(self, nl_query: str) -> Dict:
        """Parse and execute natural language query."""
        nl_query = nl_query.lower().strip()
        
        # Extract target classes from query
        target_classes = self._extract_classes(nl_query)
        
        # Extract relationship type
        rel_type = self._extract_relationship(nl_query)
        
        # Find matching objects
        results = self._find_matches(target_classes, rel_type)
        
        return results
    
    def _extract_classes(self, query: str) -> List[str]:
        """Extract object classes from query."""
        # Common class mappings
        class_mappings = {
            "person": ["person"],
            "people": ["person"],
            "man": ["person"],
            "woman": ["person"],
            "vehicle": ["car", "truck", "bus", "motorcycle"],
            "car": ["car"],
            "bag": ["bag", "backpack", "handbag"],
            "package": ["bag", "backpack", "suitcase"],
        }
        
        found = []
        for key, classes in class_mappings.items():
            if key in query:
                found.extend(classes)
                
        return list(set(found)) if found else ["person"]
    
    def _extract_relationship(self, query: str) -> Optional[str]:
        """Extract desired relationship from query."""
        rel_keywords = {
            "holding": ["holding", "carrying", "has", "with"],
            "near": ["near", "beside", "next to", "close"],
            "above": ["above", "on top", "over"],
            "on": ["on", "sitting", "standing on"],
        }
        
        for rel, keywords in rel_keywords.items():
            for kw in keywords:
                if kw in query:
                    return rel
        return None
    
    def _find_matches(self, target_classes: List[str], rel_type: Optional[str]) -> Dict:
        """Find matching object pairs."""
        matches = {
            "primary_objects": [],
            "related_objects": [],
            "relationships_found": [],
        }
        
        # Find primary objects matching target classes
        for obj in self.objects:
            if obj["class"] in target_classes:
                matches["primary_objects"].append({
                    "id": obj["id"],
                    "class": obj["class"],
                    "confidence": round(obj["confidence"], 3),
                    "bbox": [round(x, 1) for x in obj["bbox"]],
                })
                
        # If relationship specified, find connected objects
        if rel_type:
            for rel in self.relationships:
                if rel_type in rel.get("predicate", ""):
                    # Check if subject matches target
                    for target in target_classes:
                        if rel["subject"] == target or target in rel["subject"]:
                            matches["relationships_found"].append({
                                "subject": rel["subject"],
                                "predicate": rel["predicate"],
                                "object": rel["object"],
                            })
                            
                            # Add the related object
                            for obj in self.objects:
                                if obj["class"] == rel["object"]:
                                    matches["related_objects"].append({
                                        "id": obj["id"],
                                        "class": obj["class"],
                                        "confidence": round(obj["confidence"], 3),
                                    })
        
        return matches


def draw_scene_graph(image: Image.Image, scene_graph_data: Dict, query_results: Dict = None) -> Image.Image:
    """Draw scene graph on image with annotations."""
    img = np.array(image).copy()
    
    # Draw all detected objects
    for obj in scene_graph_data["objects"]:
        bbox = obj["bbox"]
        x1, y1, x2, y2 = map(int, bbox)
        
        # Draw box
        color = (0, 255, 0)  # Green
        cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
        
        # Draw label
        label = f"{obj['class']} {obj['confidence']:.2f}"
        cv2.putText(img, label, (x1, y1 - 10), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
    
    # Highlight query results
    if query_results:
        for obj in query_results.get("primary_objects", []):
            bbox = obj["bbox"]
            x1, y1, x2, y2 = map(int, bbox)
            cv2.rectangle(img, (x1, y1), (x2, y2), (255, 0, 0), 3)  # Blue highlight
            
    return Image.fromarray(img)


# Demo images
DEMO_IMAGES = {
    "street": "https://ultralytics.com/images/bus.jpg",
    "office": "https://ultralytics.com/images/zidane.jpg",
}


def create_demo():
    """Create Gradio demo interface."""
    
    # Initialize extractor
    extractor = SceneGraphExtractor("yolov8n.pt")
    
    def process_image(image_url: str, nl_query: str):
        """Process image and answer query."""
        try:
            # Load image
            if image_url.startswith("http"):
                import requests
                response = requests.get(image_url, timeout=10)
                image = Image.open(BytesIO(response.content)).convert("RGB")
            else:
                image = Image.open(image_url).convert("RGB")
                
            # Extract scene graph
            scene_graph_data = extractor.process_image(image)
            
            # Query the graph
            engine = GraphQueryEngine(scene_graph_data)
            results = engine.query(nl_query if nl_query else "find all people")
            
            # Draw visualization
            annotated = draw_scene_graph(image, scene_graph_data, results)
            
            # Format output
            output_text = f"""
## Scene Graph Analysis

**Objects Detected:** {scene_graph_data['num_objects']}
**Relationships Found:** {scene_graph_data['num_relationships']}

### Relationships:
"""
            for rel in scene_graph_data["relationships"][:10]:
                output_text += f"- **{rel['subject']}** --[{rel['predicate']}]--> **{rel['object']}**\n"
                
            output_text += f"""
### Query Results for: "{nl_query}"

**Primary Objects Found:** {len(results.get('primary_objects', []))}
"""
            for obj in results.get("primary_objects", [])[:5]:
                output_text += f"- {obj['class']} (confidence: {obj['confidence']})\n"
                
            if results.get("relationships_found"):
                output_text += "\n**Relationships:**\n"
                for rel in results["relationships_found"]:
                    output_text += f"- {rel['subject']} {rel['predicate']} {rel['object']}\n"
                    
            return output_text, annotated
            
        except Exception as e:
            return f"Error: {str(e)}", None
    
    # Create interface
    with gr.Blocks(title="Scene Graph Query Demo") as demo:
        gr.Markdown("""
        # 🔍 Scene Graph Query System
        
        **Natural Language Search over Images using Scene Graphs**
        
        Convert any image into a searchable knowledge graph, then query it with natural language!
        
        ### Use Cases:
        - Security: "Find all people holding bags"
        - Retail: "Show customers near checkout"
        - Autonomous: "Identify vehicles parked > 10 min"
        """)
        
        with gr.Row():
            with gr.Column():
                image_input = gr.Textbox(
                    label="Image URL or Upload",
                    value=DEMO_IMAGES["street"],
                    placeholder="Enter image URL or upload an image"
                )
                query_input = gr.Textbox(
                    label="Natural Language Query",
                    value="find all people",
                    placeholder="e.g., 'find people holding bags', 'show vehicles near person'"
                )
                submit_btn = gr.Button("🔎 Analyze", variant="primary")
                
            with gr.Column():
                output_text = gr.Markdown(label="Results")
                
        with gr.Row():
            output_image = gr.Image(label="Annotated Image", type="pil")
            
        # Example queries
        gr.Examples(
            examples=[
                [DEMO_IMAGES["street"], "find all people"],
                [DEMO_IMAGES["street"], "find vehicles"],
                [DEMO_IMAGES["office"], "find person"],
            ],
            inputs=[image_input, query_input],
        )
        
        submit_btn.click(
            fn=process_image,
            inputs=[image_input, query_input],
            outputs=[output_text, output_image]
        )
        
    return demo


if __name__ == "__main__":
    from io import BytesIO
    demo = create_demo()
    demo.launch(server_name="0.0.0.0", server_port=7860)
