<script>
	import { onMount, onDestroy } from 'svelte';

	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import * as monaco from 'monaco-editor';
	import { format } from 'prettier';
	let {
		value = $bindable(''),
		language = 'json',
		disabled = false,
		handleSubmit = () => {}
	} = $props();

	let container = $state();
	let editor = $state();
	let changeDisposable = $state();

	// Prettier formatting function
	async function formatCode() {
		try {
			const parser = language === 'json' ? 'json' : 'babel';
			const formatted = await format(value, {
				parser,
				plugins: format,
				tabWidth: 2,
				useTabs: false
			});
			value = formatted;
			if (editor) {
				editor.getModel().setValue(formatted);
			}
		} catch (err) {
			console.error('Format error:', err);
		}
	}

	// todo: add faulty syntax higlighting
	// todo: clean up this component so it doesn't use hooks

	onMount(async () => {
		// Register the languageIds first. Only registered languages will be highlighted.
		monaco.languages.register({ id: 'json' });
		monaco.languages.register({ id: 'javascript' });
		editor = monaco.editor.create(container, {
			value,
			language,
			theme: 'vs-dark', // Dark theme
			automaticLayout: true, // Auto resize
			fontSize: 14,
			scrollBeyondLastLine: false,
			wordWrap: 'on',
			tabSize: 2,
			insertSpaces: true,
			autoClosingBrackets: 'always',
			autoClosingQuotes: 'always',
			formatOnType: true,
			formatOnPaste: true,

			// Cleaner UI
			lineNumbers: 'off', // No line numbers
			minimap: { enabled: false }, // No minimap
			scrollBeyondLastColumn: 0, // Remove extra inset
			padding: { top: 8, bottom: 8 }, // Improved padding
			glyphMargin: false,
			renderIndentGuides: false, // No indent guides
			automaticLayout: true,
			readOnly: disabled,

			// Better visual styling
			contextmenu: true,
			cursorStyle: 'line',
			cursorBlinking: 'blink',
			smoothedAdjustedScroll: true,
			fontFamily: 'monospace',
			fontLigatures: true
		});

		// Update bound value when editor changes
		const model = editor.getModel();

		changeDisposable = model.onDidChangeContent(() => {
			const currentValue = model.getValue();
			value = currentValue;
		});

		// Ctrl+Enter → submit
		editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, handleSubmit);

		// Shift+Alt+F → format with prettier
		editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, formatCode);

		// Also handle the standard format command
		monaco.languages.registerDocumentFormattingEditProvider(language, {
			async provideDocumentFormattingEdits(model) {
				await formatCode();
				return [];
			}
		});
	});

	onDestroy(() => {
		changeDisposable.dispose();
		editor.dispose();
	});
</script>

<InputGroup.Root>
	<InputGroup.Addon align="block-start">
		<InputGroup.Text class="font-mono text-xs tracking-[0.2em] uppercase">
			{language}
		</InputGroup.Text>
	</InputGroup.Addon>

	<div
		bind:this={container}
		class="max-h-96 min-h-42 w-full overflow-y-auto rounded border outline-none"
	></div>
</InputGroup.Root>

<style lang="postcss">
	:global(.Monokai-tmTheme .current-line) {
		background-color: transparent;
	}
	:global(.monaco-editor.vs-dark .current-line) {
		background: none;
		box-sizing: border-box;
	}
</style>
