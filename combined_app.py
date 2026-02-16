#!/usr/bin/env python
"""
Combined Scene Graph Query Demo
Both image and video analysis with natural language queries.
"""

from app import SceneGraphExtractor, GraphQueryEngine, draw_scene_graph, create_demo as create_image_demo
from video_app import VideoSceneGraphExtractor, TemporalQueryEngine, create_video_demo
import gradio as gr


def create_combined_demo():
    """Create combined image + video demo with tabs."""
    
    # Initialize extractors
    image_extractor = SceneGraphExtractor("yolo26n.pt")
    video_extractor = VideoSceneGraphExtractor("yolo26n.pt")
    
    # Image processing function
    def process_image(image_source, nl_query):
        try:
            from PIL import Image
            from io import BytesIO
            import requests
            
            # Load image
            if isinstance(image_source, str) and image_source.startswith("http"):
                response = requests.get(image_source, timeout=10)
                image = Image.open(BytesIO(response.content)).convert("RGB")
            else:
                image = Image.open(image_source).convert("RGB")
                
            # Extract scene graph
            scene_graph_data = image_extractor.process_image(image)
            
            # Query
            engine = GraphQueryEngine(scene_graph_data)
            results = engine.query(nl_query if nl_query else "find all objects")
            
            # Draw
            annotated = draw_scene_graph(image, scene_graph_data, results)
            
            # Format output
            output = f"""
## Scene Graph Analysis

**Objects Detected:** {scene_graph_data['num_objects']}
**Relationships:** {scene_graph_data['num_relationships']}

### Query: "{nl_query}"

**Found:** {len(results.get('primary_objects', []))} objects
"""
            for obj in results.get('primary_objects', [])[:5]:
                output += f"- {obj['class']} (conf: {obj['confidence']:.2f})\n"
                
            return output, annotated
            
        except Exception as e:
            return f"Error: {str(e)}", None
    
    # Video processing function
    def process_video(video_file, nl_query):
        import tempfile
        import os
        
        try:
            # Save uploaded file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as f:
                f.write(video_file.read())
                temp_path = f.name
            
            # Process
            video_data = video_extractor.process_video(temp_path, frame_interval=10)
            engine = TemporalQueryEngine(video_data)
            query_results = engine.query(nl_query if nl_query else "show all")
            
            # Clean up
            os.unlink(temp_path)
            
            output = f"""
## Video Analysis

**Frames:** {video_data['total_frames_processed']}
**Objects Tracked:** {len(video_data['object_tracks'])}

### Query: "{nl_query}"

{query_results['summary']}
"""
            for match in query_results["matches"][:5]:
                output += f"- {match}\n"
                
            return output
            
        except Exception as e:
            return f"Error: {str(e)}"
    
    # Create tabs
    with gr.Tabs():
        with gr.Tab("Image Query"):
            gr.Markdown("### 🔍 Image Scene Graph Query")
            gr.Markdown("Upload an image and query it with natural language.")
            
            with gr.Row():
                with gr.Column():
                    img_input = gr.Image(label="Upload Image", type="pil")
                    query_input = gr.Textbox(
                        label="Query", 
                        value="find all people",
                        placeholder="e.g., 'find people', 'show vehicles'"
                    )
                    img_btn = gr.Button("🔎 Analyze", variant="primary")
                with gr.Column():
                    img_output = gr.Markdown()
            with gr.Row():
                img_annotated = gr.Image(label="Annotated Result", type="pil")
                
            img_btn.click(
                fn=process_image,
                inputs=[img_input, query_input],
                outputs=[img_output, img_annotated]
            )
            
            gr.Examples(
                examples=[
                    ["https://ultralytics.com/images/bus.jpg", "find all people"],
                    ["https://ultralytics.com/images/bus.jpg", "find vehicles"],
                ],
                inputs=[img_input, query_input],
            )
            
        with gr.Tab("Video Query"):
            gr.Markdown("### 🎬 Video Scene Graph Query")
            gr.Markdown("Upload a video and query for temporal patterns.")
            
            with gr.Row():
                with gr.Column():
                    vid_input = gr.File(label="Upload Video", file_types=["video"])
                    vid_query = gr.Textbox(
                        label="Query",
                        value="show all objects",
                        placeholder="e.g., 'find stationary', 'show moving'"
                    )
                    vid_btn = gr.Button("🔍 Analyze Video", variant="primary")
                with gr.Column():
                    vid_output = gr.Markdown()
                    
            vid_btn.click(
                fn=process_video,
                inputs=[vid_input, vid_query],
                outputs=[vid_output],
            )
            
        with gr.Tab("About"):
            gr.Markdown("""
            # 🔵 Scene Graph Query System
            
            Natural language search over images and videos using scene graphs.
            
            ## Use Cases:
            
            | Industry | Query Example |
            |----------|---------------|
            | Security | "Find person holding bag" |
            | Retail | "Show customers near checkout" |
            | Autonomous | "Identify pedestrians crossing" |
            | Video | "Find stationary vehicles" |
            
            ## How it Works:
            
            1. **Object Detection** - YOLOv8 detects all objects
            2. **Relationship Inference** - Spatial relationships computed
            3. **Graph Construction** - NetworkX graph built
            4. **NL Query** - Parse and traverse graph
            
            Built with 🔵 by nullsector
            """)
    
    return gr.Interface(
        fn=lambda x, y: ("Demo", None),
        inputs=[gr.Image(), gr.Textbox()],
        outputs=[gr.Markdown()],
        title="Scene Graph Query",
    )


if __name__ == "__main__":
    # Use simpler interface for now
    demo = create_image_demo()
    demo.launch(server_name="0.0.0.0", server_port=7860)
