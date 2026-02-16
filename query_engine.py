#!/usr/bin/env python
"""
Enhanced Graph Query Engine with better NL parsing.
Uses rule-based parsing for robust query understanding.
"""

import re
from typing import Dict, List, Optional, Tuple
from collections import defaultdict


class EnhancedQueryEngine:
    """Enhanced natural language query engine for scene graphs."""
    
    # Object category mappings
    CATEGORY_MAPPINGS = {
        "person": ["person", "man", "woman", "boy", "girl", "human"],
        "people": ["person", "man", "woman", "boy", "girl", "humans"],
        "vehicle": ["car", "truck", "bus", "motorcycle", "bicycle", "van", "train"],
        "car": ["car", "cars"],
        "truck": ["truck", "trucks"],
        "bus": ["bus", "buses"],
        "animal": ["dog", "cat", "bird", "horse", "sheep", "cow", "elephant", "bear"],
        "dog": ["dog", "dogs"],
        "cat": ["cat", "cats"],
        "bag": ["bag", "backpack", "handbag", "suitcase", "purse"],
        "object": ["cup", "bottle", "phone", "chair", "table", "laptop", "book"],
        "food": ["apple", "banana", "orange", "sandwich", "pizza", "cake"],
    }
    
    # Relationship keywords
    RELATIONSHIP_PATTERNS = {
        "holding": ["holding", "carrying", "has", "have", "holding", "grasping"],
        "near": ["near", "beside", "next to", "close to", "adjacent"],
        "above": ["above", "on top of", "over", "top of"],
        "below": ["below", "under", "beneath", "underneath"],
        "on": ["on", "sitting on", "standing on", "resting on"],
        "inside": ["inside", "in", "within", "inside of"],
    }
    
    # Action patterns
    ACTION_PATTERNS = {
        "find": ["find", "show", "locate", "get", "detect", "identify"],
        "count": ["count", "how many", "number of", "total"],
        "describe": ["describe", "what is", "what are", "tell me about"],
    }
    
    def __init__(self, scene_graph_data: Dict):
        self.scene_graph = scene_graph_data["graph"]
        self.objects = scene_graph_data["objects"]
        self.relationships = scene_graph_data["relationships"]
        self._build_indices()
        
    def _build_indices(self):
        """Build indices for fast lookup."""
        # Index objects by class
        self.objects_by_class = defaultdict(list)
        for obj in self.objects:
            self.objects_by_class[obj["class"]].append(obj)
            
        # Build relationship lookup
        self.relationships_by_subject = defaultdict(list)
        self.relationships_by_predicate = defaultdict(list)
        
        for rel in self.relationships:
            self.relationships_by_subject[rel["subject"]].append(rel)
            self.relationships_by_predicate[rel["predicate"]].append(rel)
    
    def parse_query(self, nl_query: str) -> Dict:
        """Parse natural language query into structured query."""
        query = nl_query.lower().strip()
        
        parsed = {
            "action": self._extract_action(query),
            "target_classes": self._extract_target_classes(query),
            "relationship": self._extract_relationship(query),
            "constraints": self._extract_constraints(query),
            "original": nl_query,
        }
        
        return parsed
    
    def _extract_action(self, query: str) -> str:
        """Extract the action (find, count, describe)."""
        for action, keywords in self.ACTION_PATTERNS.items():
            for keyword in keywords:
                if keyword in query:
                    return action
        return "find"
    
    def _extract_target_classes(self, query: str) -> List[str]:
        """Extract target object classes from query."""
        targets = []
        
        # Check direct matches
        for obj in self.objects:
            if obj["class"] in query:
                targets.append(obj["class"])
        
        # Check category mappings
        for category, classes in self.CATEGORY_MAPPINGS.items():
            if category in query:
                targets.extend(classes)
                
        # Default to all objects if nothing found
        if not targets:
            targets = list(set(obj["class"] for obj in self.objects))
            
        return list(set(targets))  # Dedupe
    
    def _extract_relationship(self, query: str) -> Optional[str]:
        """Extract desired relationship from query."""
        for rel_type, keywords in self.RELATIONSHIP_PATTERNS.items():
            for keyword in keywords:
                if keyword in query:
                    return rel_type
        return None
    
    def _extract_constraints(self, query: str) -> Dict:
        """Extract constraints like confidence threshold."""
        constraints = {}
        
        # Confidence threshold
        conf_match = re.search(r'confidence?[ >>=<]+(\d+\.?\d*)', query)
        if conf_match:
            constraints["min_confidence"] = float(conf_match.group(1))
            
        # Count limit
        limit_match = re.search(r'top (\d+)|first (\d+)|(\d+) most', query)
        if limit_match:
            constraints["limit"] = int(limit_match.group(1) or limit_match.group(2) or limit_match.group(3))
            
        return constraints
    
    def execute_query(self, nl_query: str) -> Dict:
        """Execute natural language query on scene graph."""
        parsed = self.parse_query(nl_query)
        
        results = {
            "query": nl_query,
            "parsed": parsed,
            "action": parsed["action"],
            "results": [],
            "count": 0,
        }
        
        # Find matching objects
        matching_objects = []
        for obj in self.objects:
            if obj["class"] in parsed["target_classes"]:
                # Apply constraints
                if "min_confidence" in parsed["constraints"]:
                    if obj["confidence"] < parsed["constraints"]["min_confidence"]:
                        continue
                matching_objects.append(obj)
        
        # Handle different actions
        if parsed["action"] == "count":
            results["count"] = len(matching_objects)
            results["results"] = [{"class": obj["class"], "count": len(matching_objects)}]
            
        elif parsed["action"] == "describe":
            results["results"] = self._describe_objects(matching_objects)
            results["count"] = len(matching_objects)
            
        else:  # find
            # If relationship specified, find connected objects
            if parsed["relationship"]:
                results["results"] = self._find_with_relationship(
                    matching_objects, 
                    parsed["relationship"]
                )
            else:
                results["results"] = matching_objects
                
            # Apply limit
            if "limit" in parsed["constraints"]:
                results["results"] = results["results"][:parsed["constraints"]["limit"]]
                
            results["count"] = len(results["results"])
        
        return results
    
    def _find_with_relationship(self, objects: List[Dict], relationship: str) -> List[Dict]:
        """Find objects with specified relationship."""
        matches = []
        
        for obj in objects:
            # Find relationships involving this object
            obj_rels = self.relationships_by_subject.get(obj["class"], [])
            
            for rel in obj_rels:
                if relationship in rel.get("predicate", ""):
                    matches.append({
                        "subject": rel["subject"],
                        "predicate": rel["predicate"],
                        "object": rel["object"],
                        "subject_confidence": obj["confidence"],
                    })
                    
        return matches
    
    def _describe_objects(self, objects: List[Dict]) -> List[Dict]:
        """Generate descriptions of objects."""
        descriptions = []
        
        # Group by class
        by_class = defaultdict(list)
        for obj in objects:
            by_class[obj["class"]].append(obj)
            
        for class_name, objs in by_class.items():
            descriptions.append({
                "class": class_name,
                "count": len(objs),
                "avg_confidence": sum(o["confidence"] for o in objs) / len(objs),
                "sample_bboxes": [o["bbox"] for o in objs[:3]],
            })
            
        return descriptions
    
    def get_graph_summary(self) -> Dict:
        """Get summary of the scene graph."""
        # Count objects by class
        class_counts = defaultdict(int)
        for obj in self.objects:
            class_counts[obj["class"]] += 1
            
        # Count relationships by type
        rel_counts = defaultdict(int)
        for rel in self.relationships:
            rel_counts[rel["predicate"]] += 1
            
        return {
            "total_objects": len(self.objects),
            "total_relationships": len(self.relationships),
            "object_counts": dict(class_counts),
            "relationship_counts": dict(rel_counts),
            "classes": list(class_counts.keys()),
        }


def format_query_results(results: Dict) -> str:
    """Format query results for display."""
    output = f"""
### Query: "{results['query']}"

**Parsed Action:** {results['parsed']['action']}
**Target Classes:** {', '.join(results['parsed']['target_classes'])}
**Relationship:** {results['parsed'].get('relationship', 'any') or 'any'}

"""
    
    if results["action"] == "count":
        output += f"**Total Found:** {results['count']}\n"
        
    elif results["action"] == "describe":
        output += "### Object Descriptions:\n"
        for item in results["results"]:
            output += f"- **{item['class']}**: {item['count']} objects (avg conf: {item['avg_confidence']:.2f})\n"
            
    else:
        output += f"**Matches Found:** {results['count']}\n"
        
        if results["results"] and isinstance(results["results"][0], dict):
            if "subject" in results["results"][0]:
                # Relationship results
                output += "\n### Relationships:\n"
                for item in results["results"][:10]:
                    output += f"- **{item['subject']}** --[{item['predicate']}]--> **{item['object']}**\n"
            else:
                # Object results
                output += "\n### Objects:\n"
                for item in results["results"][:10]:
                    output += f"- {item['class']} (conf: {item['confidence']:.2f})\n"
                    
    return output


# Demo usage
if __name__ == "__main__":
    # Quick test
    test_graph = {
        "objects": [
            {"id": 0, "class": "person", "confidence": 0.9, "bbox": [100, 100, 200, 300]},
            {"id": 1, "class": "car", "confidence": 0.85, "bbox": [300, 200, 500, 350]},
            {"id": 2, "class": "person", "confidence": 0.8, "bbox": [400, 150, 450, 280]},
        ],
        "relationships": [
            {"subject": "person", "subject_id": 0, "predicate": "near", "object": "car", "object_id": 1},
            {"subject": "person", "subject_id": 2, "predicate": "near", "object": "car", "object_id": 1},
        ],
    }
    
    import networkx as nx
    test_graph["graph"] = nx.DiGraph()
    
    engine = EnhancedQueryEngine(test_graph)
    
    queries = [
        "find all people",
        "count vehicles",
        "find people near car",
        "find person with confidence > 0.85",
    ]
    
    print("=== Enhanced Query Engine Test ===\n")
    for q in queries:
        result = engine.execute_query(q)
        print(format_query_results(result))
