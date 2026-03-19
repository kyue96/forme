"""
Blender Exercise Pose Renderer

Loads a rigged mannequin FBX, poses it for each exercise, and renders
start/end transparent PNGs.

Usage:
  blender --background --python scripts/render-exercises.py

Output:
  assets/exercises/{exercise-name}/0.png (start)
  assets/exercises/{exercise-name}/1.png (end)

The mannequin FBX must be at: scripts/Mannequin.fbx
"""

import bpy
import os
import sys
import math
import json

# ── Paths ──
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
FBX_PATH = os.path.join(SCRIPT_DIR, "character.fbx")
OUTPUT_DIR = os.path.join(PROJECT_DIR, "assets", "exercises")
IMAGE_SIZE = 512

# ── Exercise poses (mirrored from exercise-poses.ts) ──
# Joint angles: degrees from vertical. Positive = clockwise.
STANDING = {
    "leftShoulder": -15, "leftElbow": 0,
    "rightShoulder": 15, "rightElbow": 0,
    "leftHip": -5, "leftKnee": 0,
    "rightHip": 5, "rightKnee": 0,
    "torsoLean": 0,
}

def pose(overrides):
    p = dict(STANDING)
    p.update(overrides)
    return p

ARMS_OVERHEAD = {"leftShoulder": -160, "leftElbow": 10, "rightShoulder": 160, "rightElbow": -10}
ARMS_FRONT_HOLD = {"leftShoulder": -70, "leftElbow": -20, "rightShoulder": 70, "rightElbow": 20}
SQUAT_BOTTOM = {"leftHip": -40, "leftKnee": -80, "rightHip": 40, "rightKnee": 80, "torsoLean": 15}
LUNGE_BOTTOM = {"leftHip": -30, "leftKnee": -70, "rightHip": 50, "rightKnee": 70, "torsoLean": 5}

EXERCISE_POSES = {
    # CHEST
    "barbell bench press": [
        pose({"leftShoulder": -90, "leftElbow": -90, "rightShoulder": 90, "rightElbow": 90, "torsoLean": 0}),
        pose({"leftShoulder": -90, "leftElbow": 0, "rightShoulder": 90, "rightElbow": 0, "torsoLean": 0}),
    ],
    "dumbbell bench press": [
        pose({"leftShoulder": -90, "leftElbow": -90, "rightShoulder": 90, "rightElbow": 90}),
        pose({"leftShoulder": -90, "leftElbow": 0, "rightShoulder": 90, "rightElbow": 0}),
    ],
    "push-up": [
        pose({"leftShoulder": -70, "leftElbow": -90, "rightShoulder": 70, "rightElbow": 90, "leftHip": -5, "rightHip": 5, "torsoLean": 70}),
        pose({"leftShoulder": -70, "leftElbow": -10, "rightShoulder": 70, "rightElbow": 10, "leftHip": -5, "rightHip": 5, "torsoLean": 70}),
    ],
    "dumbbell chest fly": [
        pose({"leftShoulder": -120, "leftElbow": -20, "rightShoulder": 120, "rightElbow": 20}),
        pose({"leftShoulder": -80, "leftElbow": -10, "rightShoulder": 80, "rightElbow": 10}),
    ],
    "cable crossover": [
        pose({"leftShoulder": -130, "leftElbow": -15, "rightShoulder": 130, "rightElbow": 15}),
        pose({"leftShoulder": -30, "leftElbow": -10, "rightShoulder": 30, "rightElbow": 10, "torsoLean": 10}),
    ],
    "incline bench press": [
        pose({"leftShoulder": -110, "leftElbow": -90, "rightShoulder": 110, "rightElbow": 90, "torsoLean": -20}),
        pose({"leftShoulder": -110, "leftElbow": 0, "rightShoulder": 110, "rightElbow": 0, "torsoLean": -20}),
    ],
    "chest dip": [
        pose({"leftShoulder": -20, "leftElbow": 0, "rightShoulder": 20, "rightElbow": 0, "leftHip": 15, "rightHip": -15, "leftKnee": -40, "rightKnee": 40}),
        pose({"leftShoulder": -40, "leftElbow": -90, "rightShoulder": 40, "rightElbow": 90, "leftHip": 15, "rightHip": -15, "leftKnee": -40, "rightKnee": 40}),
    ],
    # BACK
    "pull-up": [
        pose({"leftShoulder": -160, "leftElbow": 0, "rightShoulder": 160, "rightElbow": 0, "leftHip": 5, "rightHip": -5, "leftKnee": -20, "rightKnee": 20}),
        pose({"leftShoulder": -100, "leftElbow": -80, "rightShoulder": 100, "rightElbow": 80, "leftHip": 5, "rightHip": -5, "leftKnee": -20, "rightKnee": 20}),
    ],
    "lat pulldown": [
        pose(ARMS_OVERHEAD),
        pose({"leftShoulder": -100, "leftElbow": -90, "rightShoulder": 100, "rightElbow": 90}),
    ],
    "barbell row": [
        pose({"leftShoulder": -10, "leftElbow": 0, "rightShoulder": 10, "rightElbow": 0, "torsoLean": 45, "leftHip": -20, "rightHip": 20, "leftKnee": -15, "rightKnee": 15}),
        pose({"leftShoulder": -50, "leftElbow": -100, "rightShoulder": 50, "rightElbow": 100, "torsoLean": 45, "leftHip": -20, "rightHip": 20, "leftKnee": -15, "rightKnee": 15}),
    ],
    "deadlift": [
        pose({"torsoLean": 50, "leftHip": -30, "leftKnee": -40, "rightHip": 30, "rightKnee": 40, "leftShoulder": -10, "rightShoulder": 10}),
        pose({"torsoLean": 0, "leftHip": -5, "leftKnee": 0, "rightHip": 5, "rightKnee": 0, "leftShoulder": -15, "rightShoulder": 15}),
    ],
    # SHOULDERS
    "overhead press": [
        pose({"leftShoulder": -130, "leftElbow": -90, "rightShoulder": 130, "rightElbow": 90}),
        pose(ARMS_OVERHEAD),
    ],
    "dumbbell lateral raise": [
        pose({"leftShoulder": -15, "leftElbow": -10, "rightShoulder": 15, "rightElbow": 10}),
        pose({"leftShoulder": -110, "leftElbow": -10, "rightShoulder": 110, "rightElbow": 10}),
    ],
    "face pull": [
        pose({"leftShoulder": -70, "leftElbow": 0, "rightShoulder": 70, "rightElbow": 0}),
        pose({"leftShoulder": -110, "leftElbow": -120, "rightShoulder": 110, "rightElbow": 120}),
    ],
    # BICEPS
    "barbell curl": [
        pose({"leftShoulder": -15, "leftElbow": 0, "rightShoulder": 15, "rightElbow": 0}),
        pose({"leftShoulder": -15, "leftElbow": -140, "rightShoulder": 15, "rightElbow": 140}),
    ],
    "dumbbell curl": [
        pose({"leftShoulder": -15, "leftElbow": 0, "rightShoulder": 15, "rightElbow": 0}),
        pose({"leftShoulder": -15, "leftElbow": -140, "rightShoulder": 15, "rightElbow": 140}),
    ],
    "hammer curl": [
        pose({"leftShoulder": -15, "leftElbow": 0, "rightShoulder": 15, "rightElbow": 0}),
        pose({"leftShoulder": -15, "leftElbow": -130, "rightShoulder": 15, "rightElbow": 130}),
    ],
    # TRICEPS
    "tricep pushdown": [
        pose({"leftShoulder": -15, "leftElbow": -90, "rightShoulder": 15, "rightElbow": 90}),
        pose({"leftShoulder": -15, "leftElbow": 0, "rightShoulder": 15, "rightElbow": 0}),
    ],
    "skull crusher": [
        pose({"leftShoulder": -130, "leftElbow": -120, "rightShoulder": 130, "rightElbow": 120}),
        pose({"leftShoulder": -130, "leftElbow": 0, "rightShoulder": 130, "rightElbow": 0}),
    ],
    # LEGS
    "squat": [
        pose({"leftShoulder": -70, "leftElbow": -20, "rightShoulder": 70, "rightElbow": 20}),
        pose({**ARMS_FRONT_HOLD, **SQUAT_BOTTOM}),
    ],
    "barbell squat": [
        pose({"leftShoulder": -130, "leftElbow": -60, "rightShoulder": 130, "rightElbow": 60}),
        pose({"leftShoulder": -130, "leftElbow": -60, "rightShoulder": 130, "rightElbow": 60, **SQUAT_BOTTOM}),
    ],
    "lunge": [
        pose({}),
        pose(LUNGE_BOTTOM),
    ],
    "leg press": [
        pose({"leftHip": -60, "leftKnee": -80, "rightHip": 60, "rightKnee": 80, "torsoLean": -30}),
        pose({"leftHip": -60, "leftKnee": -10, "rightHip": 60, "rightKnee": 10, "torsoLean": -30}),
    ],
    "romanian deadlift": [
        pose({"leftShoulder": -15, "rightShoulder": 15}),
        pose({"torsoLean": 50, "leftHip": -20, "rightHip": 20, "leftShoulder": -10, "rightShoulder": 10, "leftKnee": -10, "rightKnee": 10}),
    ],
    "calf raise": [
        pose({}),
        pose({"leftHip": -5, "rightHip": 5}),
    ],
    # CORE
    "plank": [
        pose({"torsoLean": 75, "leftShoulder": -70, "leftElbow": -90, "rightShoulder": 70, "rightElbow": 90, "leftHip": -5, "rightHip": 5}),
        pose({"torsoLean": 75, "leftShoulder": -70, "leftElbow": -90, "rightShoulder": 70, "rightElbow": 90, "leftHip": -5, "rightHip": 5}),
    ],
    "crunch": [
        pose({"torsoLean": 80, "leftShoulder": -120, "leftElbow": -60, "rightShoulder": 120, "rightElbow": 60, "leftHip": -40, "leftKnee": -80, "rightHip": 40, "rightKnee": 80}),
        pose({"torsoLean": 50, "leftShoulder": -120, "leftElbow": -60, "rightShoulder": 120, "rightElbow": 60, "leftHip": -40, "leftKnee": -80, "rightHip": 40, "rightKnee": 80}),
    ],
    "hanging leg raise": [
        pose(ARMS_OVERHEAD | {"leftHip": -5, "rightHip": 5}),
        pose(ARMS_OVERHEAD | {"leftHip": -70, "leftKnee": 0, "rightHip": 70, "rightKnee": 0}),
    ],
    # CARDIO
    "kettlebell swing": [
        pose({"torsoLean": 40, "leftShoulder": -10, "leftElbow": 0, "rightShoulder": 10, "rightElbow": 0, "leftHip": -20, "leftKnee": -30, "rightHip": 20, "rightKnee": 30}),
        pose({"torsoLean": -5, **ARMS_FRONT_HOLD, "leftHip": -5, "rightHip": 5}),
    ],
    "burpee": [
        pose({}),
        pose({"torsoLean": 75, "leftShoulder": -70, "leftElbow": -90, "rightShoulder": 70, "rightElbow": 90, "leftHip": -5, "rightHip": 5}),
    ],
}

# ── Bone name mapping ──
# FBX mannequins typically use these bone names. Adjust if your model differs.
# Common naming: Hips, Spine, Spine1, Spine2, Neck, Head,
#   LeftArm/LeftForeArm/LeftHand, RightArm/RightForeArm/RightHand,
#   LeftUpLeg/LeftLeg/LeftFoot, RightUpLeg/RightLeg/RightFoot

BONE_MAP_VARIANTS = [
    # Standard Mixamo naming
    {
        "torso": "Spine",
        "leftShoulder": "LeftArm",
        "leftElbow": "LeftForeArm",
        "rightShoulder": "RightArm",
        "rightElbow": "RightForeArm",
        "leftHip": "LeftUpLeg",
        "leftKnee": "LeftLeg",
        "rightHip": "RightUpLeg",
        "rightKnee": "RightLeg",
    },
    # Alternative naming with mixamorig: prefix
    {
        "torso": "mixamorig:Spine",
        "leftShoulder": "mixamorig:LeftArm",
        "leftElbow": "mixamorig:LeftForeArm",
        "rightShoulder": "mixamorig:RightArm",
        "rightElbow": "mixamorig:RightForeArm",
        "leftHip": "mixamorig:LeftUpLeg",
        "leftKnee": "mixamorig:LeftLeg",
        "rightHip": "mixamorig:RightUpLeg",
        "rightKnee": "mixamorig:RightLeg",
    },
    # mixamorig1: prefix (newer Mixamo exports)
    {
        "torso": "mixamorig1:Spine",
        "leftShoulder": "mixamorig1:LeftArm",
        "leftElbow": "mixamorig1:LeftForeArm",
        "rightShoulder": "mixamorig1:RightArm",
        "rightElbow": "mixamorig1:RightForeArm",
        "leftHip": "mixamorig1:LeftUpLeg",
        "leftKnee": "mixamorig1:LeftLeg",
        "rightHip": "mixamorig1:RightUpLeg",
        "rightKnee": "mixamorig1:RightLeg",
    },
    # Blender default Human naming
    {
        "torso": "spine",
        "leftShoulder": "upper_arm.L",
        "leftElbow": "forearm.L",
        "rightShoulder": "upper_arm.R",
        "rightElbow": "forearm.R",
        "leftHip": "thigh.L",
        "leftKnee": "shin.L",
        "rightHip": "thigh.R",
        "rightKnee": "shin.R",
    },
]


def setup_scene():
    """Clean scene and set up render settings."""
    # Delete all objects
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

    # Render settings
    scene = bpy.context.scene
    scene.render.resolution_x = IMAGE_SIZE
    scene.render.resolution_y = IMAGE_SIZE
    scene.render.film_transparent = True  # Transparent background
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'EEVEE_NEXT') else 'BLENDER_EEVEE'

    # World: dark/transparent
    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.05, 0.05, 0.06, 1.0)
        bg.inputs[1].default_value = 0.3


def setup_lighting():
    """Minimal studio lighting for clean silhouette."""
    # Key light (front-top)
    bpy.ops.object.light_add(type='AREA', location=(0, -3, 4))
    key = bpy.context.object
    key.data.energy = 150
    key.data.size = 4
    key.rotation_euler = (math.radians(45), 0, 0)

    # Rim light (back, subtle)
    bpy.ops.object.light_add(type='AREA', location=(0, 3, 3))
    rim = bpy.context.object
    rim.data.energy = 50
    rim.data.size = 3
    rim.rotation_euler = (math.radians(-45), 0, 0)


def setup_camera():
    """Front-facing camera for mannequin."""
    bpy.ops.object.camera_add(location=(0, -4.5, 1.0))
    cam = bpy.context.object
    cam.rotation_euler = (math.radians(82), 0, 0)
    bpy.context.scene.camera = cam
    cam.data.lens = 65  # Slight telephoto to reduce distortion


def apply_mannequin_material(obj):
    """Apply clean white/light gray material for mannequin look."""
    mat = bpy.data.materials.new(name="MannequinMaterial")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.85, 0.85, 0.87, 1.0)  # Light gray
        bsdf.inputs["Roughness"].default_value = 0.3  # Slightly glossy
        bsdf.inputs["Specular IOR Level"].default_value = 0.5 if "Specular IOR Level" in bsdf.inputs else 0.5

    # Apply to all mesh children
    if obj.type == 'MESH':
        obj.data.materials.clear()
        obj.data.materials.append(mat)
    for child in obj.children_recursive:
        if child.type == 'MESH':
            child.data.materials.clear()
            child.data.materials.append(mat)


def load_mannequin():
    """Import the FBX mannequin."""
    if not os.path.exists(FBX_PATH):
        print(f"ERROR: Mannequin FBX not found at {FBX_PATH}")
        sys.exit(1)

    bpy.ops.import_scene.fbx(filepath=FBX_PATH)

    # Find armature
    armature = None
    for obj in bpy.context.scene.objects:
        if obj.type == 'ARMATURE':
            armature = obj
            break

    if not armature:
        print("ERROR: No armature found in FBX. Is the model rigged?")
        print("Objects found:", [o.name for o in bpy.context.scene.objects])
        sys.exit(1)

    # Apply mannequin material
    apply_mannequin_material(armature)

    # Print bone names for debugging
    print(f"\nArmature: {armature.name}")
    print(f"Bones ({len(armature.data.bones)}):")
    for bone in armature.data.bones:
        print(f"  - {bone.name}")

    return armature


def find_bone_map(armature):
    """Auto-detect which bone naming convention the model uses."""
    bone_names = {b.name for b in armature.data.bones}

    for variant in BONE_MAP_VARIANTS:
        # Check if at least half the bones match
        matches = sum(1 for v in variant.values() if v in bone_names)
        if matches >= len(variant) // 2:
            print(f"\nDetected bone naming: {list(variant.values())[:3]}...")
            return variant

    print("\nWARNING: Could not auto-detect bone naming convention.")
    print("Available bones:", sorted(bone_names))
    print("\nAttempting partial match...")

    # Try fuzzy matching
    result = {}
    for key, candidates in [
        ("torso", ["spine", "Spine", "torso"]),
        ("leftShoulder", ["LeftArm", "upper_arm.L", "L_Arm", "Left_Arm"]),
        ("leftElbow", ["LeftForeArm", "forearm.L", "L_ForeArm", "Left_ForeArm"]),
        ("rightShoulder", ["RightArm", "upper_arm.R", "R_Arm", "Right_Arm"]),
        ("rightElbow", ["RightForeArm", "forearm.R", "R_ForeArm", "Right_ForeArm"]),
        ("leftHip", ["LeftUpLeg", "thigh.L", "L_UpLeg", "Left_UpLeg"]),
        ("leftKnee", ["LeftLeg", "shin.L", "L_Leg", "Left_Leg"]),
        ("rightHip", ["RightUpLeg", "thigh.R", "R_UpLeg", "Right_UpLeg"]),
        ("rightKnee", ["RightLeg", "shin.R", "R_Leg", "Right_Leg"]),
    ]:
        for candidate in candidates:
            for bn in bone_names:
                if candidate.lower() in bn.lower():
                    result[key] = bn
                    break
            if key in result:
                break

    if len(result) >= 5:
        print(f"Fuzzy matched {len(result)} bones: {result}")
        return result

    print("ERROR: Could not map bones. Please update BONE_MAP_VARIANTS for your model.")
    return None


def apply_pose(armature, bone_map, exercise_pose):
    """
    Apply joint angles to the armature bones.

    The 2D SVG system uses "angle from vertical" (0 = hanging down, -90 = horizontal left).
    Mixamo T-pose has arms out horizontally and legs straight down.

    Mixamo bone axes (after FBX import to Blender):
      - LeftArm:    Y-axis rotation raises/lowers arm from T-pose
      - LeftForeArm: Y-axis rotation bends elbow
      - RightArm:   Y-axis rotation raises/lowers (inverted)
      - RightForeArm: Y-axis rotation bends elbow (inverted)
      - LeftUpLeg:  X-axis rotation moves leg forward/back
      - LeftLeg:    X-axis rotation bends knee
      - Spine:      X-axis rotation for forward/back lean
    """
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode='POSE')

    # Reset all bones first
    for pbone in armature.pose.bones:
        pbone.rotation_mode = 'XYZ'
        pbone.rotation_euler = (0, 0, 0)

    # ── Torso lean ──
    # Positive torsoLean = lean forward. Spine X rotation = forward lean.
    torso_bone_name = bone_map.get("torso")
    if torso_bone_name and torso_bone_name in armature.pose.bones:
        bone = armature.pose.bones[torso_bone_name]
        lean = exercise_pose.get("torsoLean", 0)
        bone.rotation_euler.x = math.radians(-lean)  # Negative because Blender spine X forward is negative

    # ── Left Arm ──
    # SVG: leftShoulder -90 = horizontal = T-pose rest. So offset by +90.
    # In Mixamo, LeftArm Y-rotation: positive = raise up, negative = lower down
    ls_bone = bone_map.get("leftShoulder")
    if ls_bone and ls_bone in armature.pose.bones:
        bone = armature.pose.bones[ls_bone]
        angle = exercise_pose.get("leftShoulder", -15)
        # Convert from "angle from vertical" to "offset from T-pose"
        # T-pose = -90 degrees from vertical. So delta = angle - (-90) = angle + 90
        delta = angle + 90  # Positive = above T-pose, negative = below
        bone.rotation_euler.y = math.radians(delta)

    # Left Elbow: bend. SVG uses cumulative angle, we just want the bend.
    le_bone = bone_map.get("leftElbow")
    if le_bone and le_bone in armature.pose.bones:
        bone = armature.pose.bones[le_bone]
        angle = exercise_pose.get("leftElbow", 0)
        bone.rotation_euler.y = math.radians(angle)

    # ── Right Arm ──
    # SVG: rightShoulder 90 = horizontal = T-pose rest. Offset by -90.
    rs_bone = bone_map.get("rightShoulder")
    if rs_bone and rs_bone in armature.pose.bones:
        bone = armature.pose.bones[rs_bone]
        angle = exercise_pose.get("rightShoulder", 15)
        delta = angle - 90  # Positive SVG = right side. T-pose = 90.
        bone.rotation_euler.y = math.radians(-delta)  # Invert for right side

    # Right Elbow
    re_bone = bone_map.get("rightElbow")
    if re_bone and re_bone in armature.pose.bones:
        bone = armature.pose.bones[re_bone]
        angle = exercise_pose.get("rightElbow", 0)
        bone.rotation_euler.y = math.radians(-angle)  # Invert for right side

    # ── Left Leg ──
    # SVG: leftHip angle from vertical. 0 = straight down = rest position.
    # Mixamo LeftUpLeg X-rotation: negative = forward, positive = backward
    lh_bone = bone_map.get("leftHip")
    if lh_bone and lh_bone in armature.pose.bones:
        bone = armature.pose.bones[lh_bone]
        angle = exercise_pose.get("leftHip", -5)
        bone.rotation_euler.x = math.radians(angle)

    # Left Knee: bend forward
    lk_bone = bone_map.get("leftKnee")
    if lk_bone and lk_bone in armature.pose.bones:
        bone = armature.pose.bones[lk_bone]
        angle = exercise_pose.get("leftKnee", 0)
        bone.rotation_euler.x = math.radians(-angle)  # Negative = bend backward (natural knee)

    # ── Right Leg ──
    rh_bone = bone_map.get("rightHip")
    if rh_bone and rh_bone in armature.pose.bones:
        bone = armature.pose.bones[rh_bone]
        angle = exercise_pose.get("rightHip", 5)
        bone.rotation_euler.x = math.radians(angle)

    rk_bone = bone_map.get("rightKnee")
    if rk_bone and rk_bone in armature.pose.bones:
        bone = armature.pose.bones[rk_bone]
        angle = exercise_pose.get("rightKnee", 0)
        bone.rotation_euler.x = math.radians(-angle)

    bpy.ops.object.mode_set(mode='OBJECT')
    # Force update
    bpy.context.view_layer.update()


def render_frame(output_path):
    """Render current frame to file."""
    bpy.context.scene.render.filepath = output_path
    bpy.ops.render.render(write_still=True)


def main():
    print("=" * 60)
    print("Forme Exercise Pose Renderer")
    print("=" * 60)

    # Setup
    setup_scene()
    setup_lighting()
    setup_camera()
    armature = load_mannequin()
    bone_map = find_bone_map(armature)

    if not bone_map:
        print("\nFailed to map bones. Exiting.")
        sys.exit(1)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    total = len(EXERCISE_POSES)
    done = 0
    failed = 0

    for exercise_name, (start_pose, end_pose) in EXERCISE_POSES.items():
        # Create output directory using sanitized name
        safe_name = exercise_name.replace(" ", "_").replace("-", "_").replace("'", "")
        exercise_dir = os.path.join(OUTPUT_DIR, safe_name)
        os.makedirs(exercise_dir, exist_ok=True)

        # Skip if already rendered
        start_path = os.path.join(exercise_dir, "0.png")
        end_path = os.path.join(exercise_dir, "1.png")
        if os.path.exists(start_path) and os.path.exists(end_path):
            done += 1
            print(f"[{done}/{total}] Skipped {exercise_name} (already exists)")
            continue

        try:
            # Render start pose
            apply_pose(armature, bone_map, start_pose)
            render_frame(start_path)

            # Render end pose
            apply_pose(armature, bone_map, end_pose)
            render_frame(end_path)

            done += 1
            print(f"[{done}/{total}] Rendered {exercise_name}")
        except Exception as e:
            failed += 1
            print(f"[FAIL] {exercise_name}: {e}")

    print(f"\nDone! {done} rendered, {failed} failed")
    print(f"Output: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
