"""
Blender Exercise Pose Renderer
==============================
Renders start/end pose PNGs for exercise demonstrations.

Usage:
  1. Open Blender
  2. Import your Mixamo rigged model (FBX with skin)
  3. Open this script in Blender's Text Editor (or Scripting tab)
  4. Run the script (Alt+P or click "Run Script")

Output:
  Creates PNG pairs in: forme-app/assets/exercise-poses/
  e.g. bicep-curl-start.png, bicep-curl-end.png

Prerequisites:
  - Your model must have a Mixamorig armature with standard bone names
  - The model should be in T-pose or rest position before running

BONE AXIS MAP (confirmed via diagnostic + bone data):
  Rest pose = T-pose (arms horizontal out to sides)

  LeftArm (bone direction = +X):
    x_axis ≈ (+1, 0, 0)  = along bone  → X rotation = ROLL
    y_axis ≈ (0, +1, 0)  = forward     → Y rotation = UP/DOWN (Y+ = up, Y- = down)
    z_axis ≈ (0, 0, +1)  = up          → Z rotation = FWD/BACK (Z- = fwd, Z+ = back)

  RightArm (bone direction = -X, MIRRORED):
    y_axis ≈ (0, +1, 0)  = forward     → Y rotation = MIRRORED (Y+ = DOWN, Y- = UP)
    z_axis ≈ (0, 0, +1)  = up          → Z rotation = MIRRORED (Z+ = fwd, Z- = back)

  For SYMMETRIC poses (both arms same direction):
    Both UP:      LeftArm Y=+val, RightArm Y=-val
    Both DOWN:    LeftArm Y=-val, RightArm Y=+val
    Both FORWARD: LeftArm Z=-val, RightArm Z=+val
    Both BACK:    LeftArm Z=+val, RightArm Z=-val

  ForeArm: Same mirroring rules. Y+ on LeftForeArm = elbow curl up.
  Spine: X+ = lean forward, X- = lean back
  UpLeg: X- = lift leg forward, X+ = leg backward
  Leg: X+ = bend knee
"""

import bpy
import math
import os
import sys

# ─── CONFIG ───────────────────────────────────────────────────────────
OUTPUT_DIR = os.path.join(os.path.dirname(bpy.data.filepath) if bpy.data.filepath else os.path.expanduser("~"),
                          "exercise-poses")
# If running from the project, override to assets folder:
PROJECT_POSES_DIR = r"C:\Users\kev\Forme\forme-app\assets\exercise-poses"
if os.path.exists(os.path.dirname(PROJECT_POSES_DIR)):
    OUTPUT_DIR = PROJECT_POSES_DIR

RENDER_WIDTH = 512
RENDER_HEIGHT = 768
TRANSPARENT_BG = True

# ─── EXERCISE POSE DEFINITIONS ───────────────────────────────────────
# Helper: L/R arm mirroring
# For LeftArm:  Y+ = up, Y- = down, Z- = forward, Z+ = back
# For RightArm: Y- = up, Y+ = down, Z+ = forward, Z- = back
# Same mirroring applies to ForeArm bones.

EXERCISES = {
    "bicep-curl": {
        "start": {
            # Arms at sides: LeftArm Y-, RightArm Y+ (mirrored!)
            "mixamorig:LeftArm": (0, -85, 0),
            "mixamorig:RightArm": (0, 85, 0),
            "mixamorig:LeftForeArm": (0, 5, 0),
            "mixamorig:RightForeArm": (0, -5, 0),
            "mixamorig:Spine": (3, 0, 0),
        },
        "end": {
            # Arms at sides, forearms curled up
            "mixamorig:LeftArm": (0, -80, 0),
            "mixamorig:RightArm": (0, 80, 0),
            "mixamorig:LeftForeArm": (0, 135, 0),
            "mixamorig:RightForeArm": (0, -135, 0),
            "mixamorig:Spine": (3, 0, 0),
        },
    },
    "squat": {
        "start": {
            # Standing upright, arms at sides
            "mixamorig:Spine": (2, 0, 0),
            "mixamorig:LeftArm": (0, -80, 0),
            "mixamorig:RightArm": (0, 80, 0),
            "mixamorig:LeftUpLeg": (-5, 0, 3),
            "mixamorig:RightUpLeg": (-5, 0, -3),
            "mixamorig:LeftLeg": (5, 0, 0),
            "mixamorig:RightLeg": (5, 0, 0),
        },
        "end": {
            # Deep squat, arms forward for balance
            "mixamorig:Spine": (25, 0, 0),
            "mixamorig:Spine1": (5, 0, 0),
            "mixamorig:LeftUpLeg": (-95, 0, 5),
            "mixamorig:RightUpLeg": (-95, 0, -5),
            "mixamorig:LeftLeg": (90, 0, 0),
            "mixamorig:RightLeg": (90, 0, 0),
            # Arms forward: LeftArm Z-, RightArm Z+
            "mixamorig:LeftArm": (0, 0, -70),
            "mixamorig:RightArm": (0, 0, 70),
            "mixamorig:LeftForeArm": (0, 20, 0),
            "mixamorig:RightForeArm": (0, -20, 0),
        },
    },
    "bench-press": {
        "start": {
            # Lockout: arms forward (toward camera), extended straight
            # LeftArm Z- = forward, RightArm Z+ = forward
            "mixamorig:LeftArm": (0, 0, -80),
            "mixamorig:RightArm": (0, 0, 80),
            "mixamorig:LeftForeArm": (0, 2, 0),
            "mixamorig:RightForeArm": (0, -2, 0),
            "mixamorig:Spine": (-5, 0, 0),
        },
        "end": {
            # Bar at chest: arms slightly to sides + forward, elbows bent 90deg
            "mixamorig:LeftArm": (0, -20, -40),
            "mixamorig:RightArm": (0, 20, 40),
            "mixamorig:LeftForeArm": (0, 90, 0),
            "mixamorig:RightForeArm": (0, -90, 0),
            "mixamorig:Spine": (-5, 0, 0),
        },
    },
    "shoulder-press": {
        "start": {
            # Arms at T-pose height, elbows bent (forearms pointing up)
            "mixamorig:LeftArm": (0, 0, 0),   # T-pose
            "mixamorig:RightArm": (0, 0, 0),
            "mixamorig:LeftForeArm": (0, 90, 0),
            "mixamorig:RightForeArm": (0, -90, 0),
            "mixamorig:Spine": (2, 0, 0),
        },
        "end": {
            # Arms overhead: LeftArm Y+, RightArm Y-
            "mixamorig:LeftArm": (0, 80, 0),
            "mixamorig:RightArm": (0, -80, 0),
            "mixamorig:LeftForeArm": (0, 10, 0),
            "mixamorig:RightForeArm": (0, -10, 0),
            "mixamorig:Spine": (2, 0, 0),
        },
    },
    "deadlift": {
        "start": {
            # Bent over, gripping bar — arms hang straight down
            "mixamorig:Spine": (55, 0, 0),
            "mixamorig:Spine1": (10, 0, 0),
            "mixamorig:LeftUpLeg": (-40, 0, 3),
            "mixamorig:RightUpLeg": (-40, 0, -3),
            "mixamorig:LeftLeg": (35, 0, 0),
            "mixamorig:RightLeg": (35, 0, 0),
            "mixamorig:LeftArm": (0, -70, 0),
            "mixamorig:RightArm": (0, 70, 0),
            "mixamorig:LeftForeArm": (0, 2, 0),
            "mixamorig:RightForeArm": (0, -2, 0),
        },
        "end": {
            # Standing tall, arms at sides
            "mixamorig:Spine": (2, 0, 0),
            "mixamorig:LeftUpLeg": (-3, 0, 3),
            "mixamorig:RightUpLeg": (-3, 0, -3),
            "mixamorig:LeftLeg": (3, 0, 0),
            "mixamorig:RightLeg": (3, 0, 0),
            "mixamorig:LeftArm": (0, -85, 0),
            "mixamorig:RightArm": (0, 85, 0),
        },
    },
    "lat-pulldown": {
        "start": {
            # Arms reaching up overhead: LeftArm Y+, RightArm Y-
            "mixamorig:LeftArm": (0, 75, 0),
            "mixamorig:RightArm": (0, -75, 0),
            "mixamorig:LeftForeArm": (0, 10, 0),
            "mixamorig:RightForeArm": (0, -10, 0),
            "mixamorig:Spine": (2, 0, 0),
        },
        "end": {
            # Bar at chest, elbows down at sides, forearms bent
            "mixamorig:LeftArm": (0, -30, 0),
            "mixamorig:RightArm": (0, 30, 0),
            "mixamorig:LeftForeArm": (0, 100, 0),
            "mixamorig:RightForeArm": (0, -100, 0),
            "mixamorig:Spine": (-5, 0, 0),
        },
    },
    "tricep-pushdown": {
        "start": {
            # Elbows at sides, forearms bent up gripping cable
            "mixamorig:LeftArm": (0, -75, 0),
            "mixamorig:RightArm": (0, 75, 0),
            "mixamorig:LeftForeArm": (0, 95, 0),
            "mixamorig:RightForeArm": (0, -95, 0),
            "mixamorig:Spine": (5, 0, 0),
        },
        "end": {
            # Elbows at sides, arms straight down
            "mixamorig:LeftArm": (0, -85, 0),
            "mixamorig:RightArm": (0, 85, 0),
            "mixamorig:LeftForeArm": (0, 5, 0),
            "mixamorig:RightForeArm": (0, -5, 0),
            "mixamorig:Spine": (5, 0, 0),
        },
    },
    "lateral-raise": {
        "start": {
            # Arms at sides
            "mixamorig:LeftArm": (0, -80, 0),
            "mixamorig:RightArm": (0, 80, 0),
            "mixamorig:LeftForeArm": (0, 3, 0),
            "mixamorig:RightForeArm": (0, -3, 0),
            "mixamorig:Spine": (2, 0, 0),
        },
        "end": {
            # Arms at shoulder height = T-pose (Y=0)
            "mixamorig:LeftArm": (0, 0, 0),
            "mixamorig:RightArm": (0, 0, 0),
            "mixamorig:LeftForeArm": (0, 5, 0),
            "mixamorig:RightForeArm": (0, -5, 0),
            "mixamorig:Spine": (2, 0, 0),
        },
    },
    "row": {
        "start": {
            # Bent over, arms hanging straight down
            "mixamorig:Spine": (40, 0, 0),
            "mixamorig:Spine1": (5, 0, 0),
            "mixamorig:LeftUpLeg": (-15, 0, 3),
            "mixamorig:RightUpLeg": (-15, 0, -3),
            "mixamorig:LeftLeg": (15, 0, 0),
            "mixamorig:RightLeg": (15, 0, 0),
            "mixamorig:LeftArm": (0, -70, 0),
            "mixamorig:RightArm": (0, 70, 0),
            "mixamorig:LeftForeArm": (0, 5, 0),
            "mixamorig:RightForeArm": (0, -5, 0),
        },
        "end": {
            # Bent over, elbows pulled back: Z+ = back for LeftArm
            "mixamorig:Spine": (40, 0, 0),
            "mixamorig:Spine1": (5, 0, 0),
            "mixamorig:LeftUpLeg": (-15, 0, 3),
            "mixamorig:RightUpLeg": (-15, 0, -3),
            "mixamorig:LeftLeg": (15, 0, 0),
            "mixamorig:RightLeg": (15, 0, 0),
            "mixamorig:LeftArm": (0, -40, 50),
            "mixamorig:RightArm": (0, 40, -50),
            "mixamorig:LeftForeArm": (0, 90, 0),
            "mixamorig:RightForeArm": (0, -90, 0),
        },
    },
    "lunge": {
        "start": {
            # Standing, arms at sides
            "mixamorig:Spine": (3, 0, 0),
            "mixamorig:LeftArm": (0, -80, 0),
            "mixamorig:RightArm": (0, 80, 0),
            "mixamorig:LeftUpLeg": (-5, 0, 3),
            "mixamorig:RightUpLeg": (-5, 0, -3),
            "mixamorig:LeftLeg": (5, 0, 0),
            "mixamorig:RightLeg": (5, 0, 0),
        },
        "end": {
            # Lunge — left leg forward, right leg back
            "mixamorig:Spine": (5, 0, 0),
            "mixamorig:LeftArm": (0, -80, 0),
            "mixamorig:RightArm": (0, 80, 0),
            "mixamorig:LeftUpLeg": (-70, 0, 3),
            "mixamorig:RightUpLeg": (25, 0, -3),
            "mixamorig:LeftLeg": (80, 0, 0),
            "mixamorig:RightLeg": (65, 0, 0),
        },
    },
    "pull-up": {
        "start": {
            # Hanging, arms overhead
            "mixamorig:LeftArm": (0, 75, 0),
            "mixamorig:RightArm": (0, -75, 0),
            "mixamorig:LeftForeArm": (0, 8, 0),
            "mixamorig:RightForeArm": (0, -8, 0),
            "mixamorig:Spine": (2, 0, 0),
        },
        "end": {
            # Chin above bar, elbows pulled down
            "mixamorig:LeftArm": (0, -30, 0),
            "mixamorig:RightArm": (0, 30, 0),
            "mixamorig:LeftForeArm": (0, 110, 0),
            "mixamorig:RightForeArm": (0, -110, 0),
            "mixamorig:Spine": (-3, 0, 0),
        },
    },
    "chest-fly": {
        "start": {
            # Arms wide open at T-pose height, slightly back
            # LeftArm Z+ = back, RightArm Z- = back
            "mixamorig:LeftArm": (0, 0, 15),
            "mixamorig:RightArm": (0, 0, -15),
            "mixamorig:LeftForeArm": (0, 10, 0),
            "mixamorig:RightForeArm": (0, -10, 0),
            "mixamorig:Spine": (-5, 0, 0),
        },
        "end": {
            # Arms squeezed together in front
            # LeftArm Z- = forward, RightArm Z+ = forward
            "mixamorig:LeftArm": (0, 0, -80),
            "mixamorig:RightArm": (0, 0, 80),
            "mixamorig:LeftForeArm": (0, 15, 0),
            "mixamorig:RightForeArm": (0, -15, 0),
            "mixamorig:Spine": (-5, 0, 0),
        },
    },
    "calf-raise": {
        "start": {
            "mixamorig:Spine": (2, 0, 0),
            "mixamorig:LeftArm": (0, -80, 0),
            "mixamorig:RightArm": (0, 80, 0),
            "mixamorig:LeftFoot": (0, 0, 0),
            "mixamorig:RightFoot": (0, 0, 0),
        },
        "end": {
            "mixamorig:Spine": (2, 0, 0),
            "mixamorig:LeftArm": (0, -80, 0),
            "mixamorig:RightArm": (0, 80, 0),
            "mixamorig:LeftFoot": (-30, 0, 0),
            "mixamorig:RightFoot": (-30, 0, 0),
        },
    },
    "leg-curl": {
        "start": {
            # Standing, legs straight, arms at sides
            "mixamorig:Spine": (5, 0, 0),
            "mixamorig:LeftArm": (0, -80, 0),
            "mixamorig:RightArm": (0, 80, 0),
            "mixamorig:LeftLeg": (3, 0, 0),
            "mixamorig:RightLeg": (3, 0, 0),
        },
        "end": {
            # Legs curled back behind
            "mixamorig:Spine": (5, 0, 0),
            "mixamorig:LeftArm": (0, -80, 0),
            "mixamorig:RightArm": (0, 80, 0),
            "mixamorig:LeftLeg": (100, 0, 0),
            "mixamorig:RightLeg": (100, 0, 0),
        },
    },
    "leg-extension": {
        "start": {
            # Seated, legs bent
            "mixamorig:Spine": (-5, 0, 0),
            "mixamorig:LeftArm": (0, -80, 0),
            "mixamorig:RightArm": (0, 80, 0),
            "mixamorig:LeftUpLeg": (-80, 0, 3),
            "mixamorig:RightUpLeg": (-80, 0, -3),
            "mixamorig:LeftLeg": (85, 0, 0),
            "mixamorig:RightLeg": (85, 0, 0),
        },
        "end": {
            # Legs extended straight
            "mixamorig:Spine": (-5, 0, 0),
            "mixamorig:LeftArm": (0, -80, 0),
            "mixamorig:RightArm": (0, 80, 0),
            "mixamorig:LeftUpLeg": (-80, 0, 3),
            "mixamorig:RightUpLeg": (-80, 0, -3),
            "mixamorig:LeftLeg": (5, 0, 0),
            "mixamorig:RightLeg": (5, 0, 0),
        },
    },
}

# ─── HELPER FUNCTIONS ─────────────────────────────────────────────────

def find_armature():
    """Find the armature object in the scene."""
    for obj in bpy.data.objects:
        if obj.type == 'ARMATURE':
            return obj
    return None


def reset_pose(armature):
    """Reset all bones to rest position."""
    bpy.context.view_layer.objects.active = armature
    if armature.mode != 'POSE':
        bpy.ops.object.mode_set(mode='POSE')
    for pbone in armature.pose.bones:
        pbone.rotation_mode = 'XYZ'
        pbone.rotation_euler = (0, 0, 0)
        pbone.location = (0, 0, 0)
        pbone.scale = (1, 1, 1)
    # Force update
    bpy.context.view_layer.update()


def apply_pose(armature, bone_rotations):
    """Apply rotation values to bones."""
    bpy.context.view_layer.objects.active = armature
    if armature.mode != 'POSE':
        bpy.ops.object.mode_set(mode='POSE')

    for bone_name, (rx, ry, rz) in bone_rotations.items():
        if bone_name in armature.pose.bones:
            pbone = armature.pose.bones[bone_name]
            pbone.rotation_mode = 'XYZ'
            pbone.rotation_euler = (
                math.radians(rx),
                math.radians(ry),
                math.radians(rz),
            )
        else:
            print(f"  WARNING: Bone '{bone_name}' not found in armature")

    # Force the dependency graph to update so the mesh deforms before render
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    depsgraph.update()


def setup_render():
    """Configure render settings for transparent PNG output."""
    scene = bpy.context.scene
    scene.render.resolution_x = RENDER_WIDTH
    scene.render.resolution_y = RENDER_HEIGHT
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.film_transparent = TRANSPARENT_BG

    # Use Eevee for speed — pick available engine
    available = {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items}
    if 'BLENDER_EEVEE_NEXT' in available:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
    elif 'BLENDER_EEVEE' in available:
        scene.render.engine = 'BLENDER_EEVEE'
    else:
        scene.render.engine = 'CYCLES'

    # Lighting
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get('Background')
    if bg:
        bg.inputs['Strength'].default_value = 0.3


def setup_camera(armature):
    """Position camera at 3/4 angle to show both up/down and forward/back motion."""
    # Find or create camera
    cam = None
    for obj in bpy.data.objects:
        if obj.type == 'CAMERA':
            cam = obj
            break
    if not cam:
        cam_data = bpy.data.cameras.new('RenderCam')
        cam = bpy.data.objects.new('RenderCam', cam_data)
        bpy.context.scene.collection.objects.link(cam)

    bpy.context.scene.camera = cam

    # 3/4 angle: offset to the right so forward/backward motion is visible
    cam.location = (1.0, -5.5, 1.2)
    cam.rotation_euler = (math.radians(82), 0, math.radians(6))
    cam.data.lens = 50


def render_pose(filepath):
    """Render the current frame to a file."""
    bpy.context.scene.render.filepath = filepath
    bpy.ops.render.render(write_still=True)
    print(f"  Rendered: {filepath}")


# ─── TEST MODE ────────────────────────────────────────────────────────
# Set to True to render diagnostic tests. Set to False for exercise renders.
TEST_MODE = False

AXIS_TESTS = [
    # Verify mirrored arm direction
    ("rest",                 {}),
    ("both-arms-down",       {"mixamorig:LeftArm": (0, -80, 0), "mixamorig:RightArm": (0, 80, 0)}),
    ("both-arms-up",         {"mixamorig:LeftArm": (0, 80, 0), "mixamorig:RightArm": (0, -80, 0)}),
    ("both-arms-forward",    {"mixamorig:LeftArm": (0, 0, -80), "mixamorig:RightArm": (0, 0, 80)}),
    # Forearm bend tests (which axis curls the elbow?)
    ("L-forearm-X+90",       {"mixamorig:LeftArm": (0, 0, 0), "mixamorig:LeftForeArm": (90, 0, 0)}),
    ("L-forearm-Y+90",       {"mixamorig:LeftArm": (0, 0, 0), "mixamorig:LeftForeArm": (0, 90, 0)}),
    ("L-forearm-Z+90",       {"mixamorig:LeftArm": (0, 0, 0), "mixamorig:LeftForeArm": (0, 0, 90)}),
    # Full bicep curl test (arms down + forearm curled via Y)
    ("bicep-curl-end-test",  {
        "mixamorig:LeftArm": (0, -80, 0), "mixamorig:RightArm": (0, 80, 0),
        "mixamorig:LeftForeArm": (0, 135, 0), "mixamorig:RightForeArm": (0, -135, 0),
    }),
]


# ─── MAIN ─────────────────────────────────────────────────────────────

def main():
    print("\n" + "=" * 60)
    print("  Exercise Pose Renderer")
    print("=" * 60)

    # Find armature
    armature = find_armature()
    if not armature:
        print("ERROR: No armature found! Import a Mixamo FBX model first.")
        return

    print(f"Found armature: {armature.name}")
    print(f"Bones: {len(armature.pose.bones)}")

    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Output: {OUTPUT_DIR}")

    # Setup
    setup_render()
    setup_camera(armature)

    # Enter pose mode once and stay there
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode='POSE')

    if TEST_MODE:
        # Render axis diagnostic tests
        print("\n*** DIAGNOSTIC MODE ***")
        print("Rendering test images...\n")
        for test_name, bone_rotations in AXIS_TESTS:
            print(f"  Test: {test_name}")
            reset_pose(armature)
            if bone_rotations:
                apply_pose(armature, bone_rotations)
            render_pose(os.path.join(OUTPUT_DIR, f"_test-{test_name}"))
        print("\nDiagnostic complete! Check the _test-*.png files.")
    else:
        # Render each exercise
        for exercise_name, poses in EXERCISES.items():
            print(f"\nRendering: {exercise_name}")

            # Start pose
            reset_pose(armature)
            apply_pose(armature, poses["start"])
            render_pose(os.path.join(OUTPUT_DIR, f"{exercise_name}-start"))

            # End pose
            reset_pose(armature)
            apply_pose(armature, poses["end"])
            render_pose(os.path.join(OUTPUT_DIR, f"{exercise_name}-end"))

    # Return to object mode
    bpy.ops.object.mode_set(mode='OBJECT')

    print(f"\nDone!")
    if not TEST_MODE:
        print(f"Rendered {len(EXERCISES) * 2} images to {OUTPUT_DIR}")
        print("Run 'node scripts/map-exercise-poses.js' to wire them into the app.")


main()
