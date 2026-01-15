<script>
	let { value = '', handleSubmit = () => {} } = $props();
	let container;

	const INDENT = '  '; // base indentation

	// ===============================
	// Undo / Redo history
	// ===============================
	const history = [];
	let historyIndex = -1;
	let isUndoRedo = false; // prevents infinite loop on value binding

	function pushHistory() {
		if (isUndoRedo) return;
		// Remove future history if any
		history.splice(historyIndex + 1);
		history.push({ value, cursor: container?.selectionStart || 0 });
		historyIndex = history.length - 1;
	}

	function undo() {
		if (historyIndex <= 0) return;
		historyIndex--;
		applyHistory(history[historyIndex]);
	}

	function redo() {
		if (historyIndex >= history.length - 1) return;
		historyIndex++;
		applyHistory(history[historyIndex]);
	}

	function applyHistory(entry) {
		if (!container || !entry) return;
		isUndoRedo = true;
		value = entry.value;
		setTimeout(() => {
			container.selectionStart = container.selectionEnd = entry.cursor;
			isUndoRedo = false;
		}, 0);
	}

	// ===============================
	// Helpers
	// ===============================
	function getCurrentLineIndent(before) {
		const lastLineBreak = before.lastIndexOf('\n');
		const lineStart = lastLineBreak + 1;
		const line = before.slice(lineStart);
		const match = line.match(/^\s*/);
		return match ? match[0] : '';
	}

	// ===============================
	// Key handling
	// ===============================
	function onKeyDown(event) {
		const textarea = event.target;
		let start = textarea.selectionStart;
		let end = textarea.selectionEnd;

		const before = value.slice(0, start);
		const after = value.slice(end);

		// Ctrl/Cmd + Enter → submit
		if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
			event.preventDefault();
			handleSubmit();
			return;
		}

		// Undo / Redo
		if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
			event.preventDefault();
			undo();
			return;
		}
		if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'z') {
			event.preventDefault();
			redo();
			return;
		}

		// Tab / Shift+Tab → multi-line indent/unindent
		if (event.key === 'Tab') {
			event.preventDefault();
			pushHistory();

			const textBeforeSelection = value.slice(0, start);
			const textSelected = value.slice(start, end);
			const textAfterSelection = value.slice(end);

			// Treat current line if nothing is selected
			const selectionLines = textSelected.length
				? textSelected.split('\n')
				: (() => {
						const lineStart = textBeforeSelection.lastIndexOf('\n') + 1;
						const lineEndRelative =
							textAfterSelection.indexOf('\n') !== -1
								? textAfterSelection.indexOf('\n')
								: textAfterSelection.length;
						return [value.slice(lineStart, start + lineEndRelative)];
					})();

			if (event.shiftKey) {
				// Unindent
				const unindentedLines = selectionLines.map((line) =>
					line.startsWith(INDENT) ? line.slice(INDENT.length) : line
				);
				const newText = unindentedLines.join('\n');

				if (textSelected.length) {
					value = textBeforeSelection + newText + textAfterSelection;
					const removedChars = selectionLines.reduce(
						(acc, line) => acc + (line.startsWith(INDENT) ? INDENT.length : 0),
						0
					);
					setTimeout(() => {
						textarea.selectionStart = start;
						textarea.selectionEnd = end - removedChars;
					}, 0);
				} else {
					const lineStart = textBeforeSelection.lastIndexOf('\n') + 1;
					value =
						value.slice(0, lineStart) + newText + value.slice(lineStart + selectionLines[0].length);
					setTimeout(() => {
						textarea.selectionStart = textarea.selectionEnd =
							start - (selectionLines[0].startsWith(INDENT) ? INDENT.length : 0);
					}, 0);
				}
			} else {
				// Indent
				const indentedLines = selectionLines.map((line) => INDENT + line);
				const newText = indentedLines.join('\n');

				if (textSelected.length) {
					value = textBeforeSelection + newText + textAfterSelection;
					setTimeout(() => {
						textarea.selectionStart = start;
						textarea.selectionEnd = end + INDENT.length * selectionLines.length;
					}, 0);
				} else {
					const lineStart = textBeforeSelection.lastIndexOf('\n') + 1;
					value =
						value.slice(0, lineStart) + newText + value.slice(lineStart + selectionLines[0].length);
					setTimeout(() => {
						textarea.selectionStart = textarea.selectionEnd = start + INDENT.length;
					}, 0);
				}
			}
			return;
		}

		// Auto-close brackets/braces/quotes
		const pairs = { '{': '}', '[': ']', '"': '"' };
		if (pairs[event.key]) {
			event.preventDefault();
			pushHistory();

			const closing = pairs[event.key];
			const beforeCursor = value.slice(0, start);
			const afterCursor = value.slice(end);

			// Smart quote handling like Monaco
			if (event.key === '"') {
				const lineStart = beforeCursor.lastIndexOf('\n') + 1;
				const lineBeforeCursor = beforeCursor.slice(lineStart);
				const openQuotes = (lineBeforeCursor.match(/"/g) || []).length;

				if (openQuotes % 2 === 0) {
					// Even → insert pair
					value = beforeCursor + '""' + afterCursor;
					setTimeout(() => {
						textarea.selectionStart = textarea.selectionEnd = start + 1;
					}, 0);
				} else {
					// Odd → skip next quote if exists
					if (afterCursor.startsWith('"')) {
						setTimeout(() => {
							textarea.selectionStart = textarea.selectionEnd = start + 1;
						}, 0);
					} else {
						value = beforeCursor + '"' + afterCursor;
						setTimeout(() => {
							textarea.selectionStart = textarea.selectionEnd = start + 1;
						}, 0);
					}
				}
				return;
			}

			// Other pairs
			value = beforeCursor + event.key + closing + afterCursor;
			setTimeout(() => {
				textarea.selectionStart = textarea.selectionEnd = start + 1;
			}, 0);
			return;
		}

		// Smart Enter → auto-indent
		if (event.key === 'Enter') {
			event.preventDefault();
			pushHistory();

			const currentIndent = getCurrentLineIndent(before);
			const openChar = before.slice(-1);
			const closeChar = after[0];
			const extraIndent =
				(openChar === '{' && closeChar === '}') || (openChar === '[' && closeChar === ']')
					? INDENT
					: '';

			const insertText = `\n${currentIndent}${extraIndent}${extraIndent ? '\n' + currentIndent : ''}`;
			value = before + insertText + after;

			setTimeout(() => {
				textarea.selectionStart = textarea.selectionEnd =
					start + 1 + currentIndent.length + extraIndent.length;
			}, 0);
		}
	}

	function onInput(event) {
		if (!isUndoRedo) pushHistory();
		value = event.target.value;
	}
</script>

<textarea
	bind:this={container}
	bind:value
	class="min-h-52 w-full resize-y bg-transparent px-2 font-mono text-xs text-foreground outline-none"
	spellcheck="false"
	autocomplete="off"
	autocapitalize="off"
	oninput={onInput}
	onkeydown={onKeyDown}
></textarea>
