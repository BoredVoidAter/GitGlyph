
import os

try:
    os.remove("C:/Users/finni/Desktop/Projects/GitGlyph/delete_delete_cli_dir_script.py")
    print("File deleted successfully.")
except OSError as e:
    print(f"Error deleting file: {e}")
