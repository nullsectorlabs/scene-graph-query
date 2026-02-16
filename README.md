# 🔍 Scene Graph Query System

**Natural Language Search over Images & Video using Scene Graphs**

Convert any image or video into a searchable knowledge graph, then query with natural language!

## 🚀 Quick Start

```bash
# Clone and install with uv
git clone https://github.com/nullsector/scene-graph-query.git
cd scene-graph-query
uv venv && uv sync

# Activate and run
source .venv/bin/activate
python app.py
```

Open http://localhost:7860 in your browser.

## 📁 Project Structure

```
scene-graph-query/
├── app.py              # Main Gradio demo (image queries)
├── video_app.py        # Video scene graph extraction
├── combined_app.py    # Combined image + video demo
├── query_engine.py     # Enhanced NL query parser
├── pyproject.toml      # uv project config
├── requirements.txt    # pip requirements (legacy)
└── README.md
```

## 💡 Use Cases

| Industry | Query Example |
|----------|---------------|
| **Security** | "Find person holding bag near entrance" |
| **Retail** | "Show customers waiting > 5 min" |
| **Autonomous** | "Identify pedestrians crossing" |
| **Content Moderation** | "Find images with weapons" |
| **Video Surveillance** | "Find stationary vehicles" |

## 🎬 Features

### ✅ Image Scene Graphs
- YOLO26 object detection
- Spatial relationship inference (above, below, near, holding, on)
- NetworkX graph construction
- Natural language query interface

### ✅ Video Scene Graphs
- Object tracking across frames
- Temporal relationship analysis
- Stationary/moving detection
- Duration-based queries

### ✅ Enhanced Query Engine
- Action parsing (find, count, describe)
- Category expansion (person → man, woman, boy...)
- Confidence thresholds
- Relationship filtering

## 🏗️ Architecture

```
┌─────────────┐    ┌──────────────────┐    ┌─────────────┐
│  Input      │───▶│  YOLO Object     │───▶│  Scene      │
│  Image/Video│    │  Detection       │    │  Graph      │
└─────────────┘    └──────────────────┘    └──────┬──────┘
                                                   │
                    ┌──────────────────┐           │
                    │  NL Query       │◀──────────┘
                    │  Parser         │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  Graph          │
                    │  Traversal     │
                    └──────────────────┘
```

## 🔧 Usage

### Image Query

```python
from app import SceneGraphExtractor, GraphQueryEngine
from PIL import Image

extractor = SceneGraphExtractor("yolo26n.pt")
graph = extractor.process_image(Image.open("photo.jpg"))

engine = GraphQueryEngine(graph)
results = engine.query("find all people holding bags")
```

### Video Query

```python
from video_app import VideoSceneGraphExtractor, TemporalQueryEngine

extractor = VideoSceneGraphExtractor("yolo26n.pt")
video_data = extractor.process_video("video.mp4")

engine = TemporalQueryEngine(video_data)
results = engine.query("find stationary objects")
```

## 📦 Requirements

- Python 3.9+
- PyTorch 2.0+
- Ultralytics **YOLO26** (latest!)
- Gradio 4.0+
- NetworkX

Install via: `uv sync`

## 🔧 Running

### Web UI (Gradio)
```bash
python app.py
```
Opens http://localhost:7860

### React Frontend (Next.js)
```bash
cd web && npm install && npm run dev
```
Opens http://localhost:3000

### Docker
```bash
docker build -t scene-graph-query .
docker run -p 7860:7860 scene-graph-query
```

## 🔒 Security

- Input validation on all user inputs
- No external API calls (runs locally)
- Safe image processing

## 📝 License

MIT License - See LICENSE file.

---

**Built with 🔵 by nullsector**
