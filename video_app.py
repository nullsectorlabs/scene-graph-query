#!/usr/bin/env python
"""
Video Scene Graph Query System
Process videos to extract temporal scene graphs with object tracking.

Use Case: Video surveillance search with temporal queries
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
from ultralytics import YOLO
import tempfile
import os


class VideoSceneGraphExtractor:
    """Extract scene graphs from video frames with tracking."""
    
    def __init__(self, model_name: str = "yolov8n.pt"):
        print(f"Loading YOLO model: {model_name}...")
        self.model = YOLO(model_name)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Using device: {self.device}")
        
    def process_video(self, video_path: str, frame_interval: int = 10) -> Dict:
        """Process video and extract temporal scene graph."""
        cap = cv2.VideoCapture(video_path)
        
        frame_data = []
        object_tracks = defaultdict(list)
        frame_idx = 0
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
                
            # Process every N frames
            if frame_idx % frame_interval == 0:
                # Convert to PIL
                image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                
                # Detect objects
                results = self.model(image, verbose=False)
                
                objects = []
                for r in results:
                    boxes = r.boxes
                    for i, box in enumerate(boxes):
                        cls_id = int(box.cls[0])
                        cls_name = self.model.names[cls_id]
                        conf = float(box.conf[0])
                        
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                        
                        obj = {
                            "id": i,
                            "class": cls_name,
                            "confidence": conf,
                            "bbox": [float(x1), float(y1), float(x2), float(y2)],
                            "center": [float(cx), float(cy)],
                            "frame": frame_idx,
                        }
                        objects.append(obj)
                        
                        # Track object across frames
                        obj_key = f"{cls_name}_{i}"
                        object_tracks[obj_key].append({
                            "frame": frame_idx,
                            "center": [float(cx), float(cy)],
                            "bbox": [float(x1), float(y1), float(x2), float(y2)],
                            "confidence": conf,
                        })
                
                frame_data.append({
                    "frame": frame_idx,
                    "objects": objects,
                })
                
            frame_idx += 1
            
            # Limit frames for demo
            if frame_idx > 100:
                break
                
        cap.release()
        
        # Compute temporal relationships
        temporal_relationships = self._compute_temporal_relationships(object_tracks)
        
        return {
            "total_frames_processed": frame_idx,
            "frames_with_data": len(frame_data),
            "object_tracks": dict(object_tracks),
            "temporal_relationships": temporal_relationships,
            "frame_data": frame_data,
        }
    
    def _compute_temporal_relationships(self, tracks: Dict) -> List[Dict]:
        """Compute temporal relationships between tracked objects."""
        relationships = []
        
        for obj_id, track_data in tracks.items():
            if len(track_data) < 2:
                continue
                
            # Compute movement
            start_pos = track_data[0]["center"]
            end_pos = track_data[-1]["center"]
            
            distance = np.sqrt(
                (end_pos[0] - start_pos[0])**2 + 
                (end_pos[1] - start_pos[1])**2
            )
            
            # Determine relationship
            if distance < 50:
                rel_type = "stationary"
            elif distance < 200:
                rel_type = "moving_slightly"
            else:
                rel_type = "moving_fast"
                
            relationships.append({
                "object": obj_id,
                "start_position": start_pos,
                "end_position": end_pos,
                "distance": float(distance),
                "relationship": rel_type,
                "frames_tracked": len(track_data),
            })
            
        return relationships


class TemporalQueryEngine:
    """Query temporal scene graphs."""
    
    def __init__(self, video_data: Dict):
        self.video_data = video_data
        self.tracks = video_data["object_tracks"]
        self.relationships = video_data["temporal_relationships"]
        
    def query(self, nl_query: str) -> Dict:
        """Query video for specific patterns."""
        nl_query = nl_query.lower()
        
        results = {
            "query": nl_query,
            "matches": [],
            "summary": "",
        }
        
        # Parse temporal queries
        if "stationary" in nl_query or "parked" in nl_query or "stopped" in nl_query:
            for rel in self.relationships:
                if rel["relationship"] == "stationary":
                    results["matches"].append({
                        "object": rel["object"],
                        "type": "stationary",
                        "frames": rel["frames_tracked"],
                    })
            results["summary"] = f"Found {len(results['matches'])} stationary objects"
            
        elif "moving" in nl_query or "moving" in nl_query:
            for rel in self.relationships:
                if rel["relationship"] in ["moving_slightly", "moving_fast"]:
                    results["matches"].append({
                        "object": rel["object"],
                        "type": rel["relationship"],
                        "distance": round(rel["distance"], 1),
                    })
            results["summary"] = f"Found {len(results['matches'])} moving objects"
            
        elif "long" in nl_query or "duration" in nl_query:
            # Find objects tracked for longest
            sorted_tracks = sorted(
                self.relationships, 
                key=lambda x: x["frames_tracked"], 
                reverse=True
            )
            results["matches"] = sorted_tracks[:5]
            results["summary"] = f"Top 5 longest-tracked objects"
            
        else:
            # Default: return all tracked objects
            results["matches"] = [
                {"object": r["object"], "frames": r["frames_tracked"]}
                for r in self.relationships[:10]
            ]
            results["summary"] = f"Showing {len(results['matches'])} tracked objects"
            
        return results


def create_video_demo():
    """Create video scene graph demo."""
    extractor = VideoSceneGraphExtractor("yolov8n.pt")
    
    def process_video_file(video_file, nl_query):
        try:
            # Save uploaded file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as f:
                f.write(video_file.read())
                temp_path = f.name
            
            # Process video
            video_data = extractor.process_video(temp_path, frame_interval=15)
            
            # Query
            engine = TemporalQueryEngine(video_data)
            query_results = engine.query(nl_query if nl_query else "show all objects")
            
            # Clean up
            os.unlink(temp_path)
            
            # Format output
            output = f"""
## Video Analysis Results

**Frames Processed:** {video_data['total_frames_processed']}
**Objects Tracked:** {len(video_data['object_tracks'])}
**Temporal Relationships:** {len(video_data['temporal_relationships'])}

### Query: "{nl_query}"

{query_results['summary']}

"""
            for match in query_results["matches"][:5]:
                output += f"- {match}\n"
                
            return output, video_data
            
        except Exception as e:
            return f"Error: {str(e)}", None
    
    with gr.Blocks(title="Video Scene Graph Query") as demo:
        gr.Markdown("""
        # 🎬 Video Scene Graph Query
        
        **Temporal Object Tracking with Natural Language Search**
        
        Upload a video to extract object tracks and query with natural language:
        - "Find stationary objects" (parked vehicles, stopped people)
        - "Show moving objects"
        - "Find objects tracked for long duration"
        """)
        
        with gr.Row():
            with gr.Column():
                video_input = gr.File(label="Upload Video", file_types=["video"])
                query_input = gr.Textbox(
                    label="Query",
                    value="show all objects",
                    placeholder="e.g., 'find stationary objects', 'show moving'"
                )
                submit_btn = gr.Button("🔍 Analyze Video", variant="primary")
                
            with gr.Column():
                output_text = gr.Markdown()
                
        gr.Markdown("""
        ### Sample Queries:
        - "Find stationary objects"
        - "Show moving objects"  
        - "Find objects tracked for long duration"
        """)
        
        submit_btn.click(
            fn=process_video_file,
            inputs=[video_input, query_input],
            outputs=[output_text],
        )
        
    return demo


if __name__ == "__main__":
    demo = create_video_demo()
    demo.launch(server_name="0.0.0.0", server_port=7861)
