import re

def check_balance(filename):
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    stack = []
    lines = content.split('\n')
    
    # Simple state machine to ignore strings and comments
    in_string = False
    string_char = ''
    in_comment = False # //
    in_block_comment = False # /* */
    
    i = 0
    length = len(content)
    
    while i < length:
        char = content[i]
        
        # Newline handling
        if char == '\n':
            if in_comment: in_comment = False
            i += 1
            continue
            
        # Handle string/comments
        if in_comment:
            i += 1
            continue
            
        if in_block_comment:
            if content[i:i+2] == '*/':
                in_block_comment = False
                i += 2
            else:
                i += 1
            continue
            
        if in_string:
            if char == '\\':
                i += 2
                continue
            if char == string_char:
                in_string = False
            i += 1
            continue
            
        # Start modifiers
        if content[i:i+2] == '//':
            in_comment = True
            i += 2
            continue
            
        if content[i:i+2] == '/*':
            in_block_comment = True
            i += 2
            continue
            
        if char in ["'", '"', '`']:
            in_string = True
            string_char = char
            i += 1
            continue
            
        # Brackets
        if char in "([{":
            # Calculate line/col for reporting
            # (Note: independent calculation to avoid off-by-one errors from previous logic)
            # This is slow but reliable for reporting
            cur_line = content[:i].count('\n') + 1
            cur_col = i - content[:i].rfind('\n') 
            stack.append((char, cur_line, cur_col))
            
        elif char in ")]}":
            cur_line = content[:i].count('\n') + 1
            cur_col = i - content[:i].rfind('\n')
            
            if not stack:
                print(f"Error: Unexpected closing '{char}' at {cur_line}:{cur_col}")
                return
            
            last, l, c = stack.pop()
            expected = {'(': ')', '[': ']', '{': '}'}[last]
            if char != expected:
                print(f"Error: Mismatched '{char}' at {cur_line}:{cur_col}. Expected '{expected}' for opening at {l}:{c}")
                return

        i += 1

    if stack:
        last, l, c = stack[-1]
        print(f"Error: Unclosed '{last}' at {l}:{c}")
        # Print context
        start_idx = -1
        # Find index of line l
        curr_l = 1
        for idx, ch in enumerate(content):
            if curr_l == l:
                start_idx = idx
                break
            if ch == '\n':
                curr_l += 1
        
        if start_idx != -1:
            end_idx = content.find('\n', start_idx)
            print(f"Context: {content[start_idx:end_idx].strip()}")

    else:
        print("No syntax errors found.")

check_balance(r"c:\Users\Josor\Documents\App OpenSource\App.tsx")
