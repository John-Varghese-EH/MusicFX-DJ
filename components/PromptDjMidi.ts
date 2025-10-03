/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import { throttle } from '../utils/throttle';

import './PromptController';
import './PlayPauseButton';
import './AudioVisualizer';
import type { PlaybackState, Prompt } from '../types';
import { MidiDispatcher } from '../utils/MidiDispatcher';

/** The grid of prompt inputs. */
@customElement('prompt-dj-midi')
// FIX: The class must extend LitElement to be a custom element.
export class PromptDjMidi extends LitElement {
  static override styles = css`
    :host {
      height: 100%;
      width: 100%;
      display: grid;
      grid-template-rows: auto 1fr auto;
      grid-template-columns: 1fr;
      box-sizing: border-box;
      position: relative;
      overflow: hidden;
    }
    #background {
      will-change: background-image;
      position: absolute;
      height: 100%;
      width: 100%;
      z-index: -1;
      background: #111;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5vmin;
      z-index: 10;
    }
    #logo {
      text-decoration: none;
    }
    #midi-controls {
      display: flex;
      align-items: center;
      gap: 1.5vmin;
    }
    main {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 4vmin;
      padding: 0 4vmin;
      align-items: center;
      justify-content: center;
      min-height: 0;
    }
    #grid-container {
      display: flex;
      justify-content: center;
      align-items: center;
    }
    #grid {
      width: 70vmin;
      height: 70vmin;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2.5vmin;
    }
    #global-controls-container {
      display: flex;
      flex-direction: column;
      gap: 2vmin;
      padding: 2vmin;
      background: rgba(0,0,0,0.1);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 1vmin;
    }
    #global-controls-container h2 {
      font-size: 2vmin;
      margin: 0;
      color: #ccc;
      text-align: center;
      font-weight: 500;
    }
    #global-controls {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3vmin;
    }
    prompt-controller {
      width: 100%;
    }
    footer {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      padding: 2vmin 4vmin;
    }
    #visualizer-container {
      position: relative;
      width: 20vmin;
      height: 20vmin;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    audio-visualizer {
      position: absolute;
      width: 100%;
      height: 100%;
    }
    play-pause-button {
      position: absolute;
      width: 15vmin;
      z-index: 10;
    }
    button {
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      color: #fff;
      background: #0002;
      -webkit-font-smoothing: antialiased;
      border: 1.5px solid #fff;
      border-radius: 4px;
      user-select: none;
      padding: 3px 6px;
      &.active {
        background-color: #fff;
        color: #000;
      }
    }
    select {
      font: inherit;
      padding: 5px;
      background: #fff;
      color: #000;
      border-radius: 4px;
      border: none;
      outline: none;
      cursor: pointer;
    }
  `;

  private prompts: Map<string, Prompt>;
  private midiDispatcher: MidiDispatcher;

  @property({ type: Boolean }) private showMidi = false;
  @property({ type: String }) public playbackState: PlaybackState = 'stopped';
  @state() public audioLevel = 0;
  @state() public frequencyData: Uint8Array = new Uint8Array();
  @state() private midiInputIds: string[] = [];
  @state() private activeMidiInputId: string | null = null;
  @state() private activeMidiChannel: number | 'all' = 'all';

  @property({ type: Object })
  private filteredPrompts = new Set<string>();

  constructor(
    initialPrompts: Map<string, Prompt>,
  ) {
    super();
    this.prompts = initialPrompts;
    this.midiDispatcher = new MidiDispatcher();
  }

  private handlePromptChanged(e: CustomEvent<Prompt>) {
    const newPrompt = e.detail;
    const prompt = this.prompts.get(newPrompt.promptId);

    if (!prompt) {
      console.error('prompt not found', newPrompt.promptId);
      return;
    }

    Object.assign(prompt, newPrompt);
    const newPrompts = new Map(this.prompts);
    this.prompts = newPrompts;
    this.requestUpdate();

    this.dispatchEvent(
      new CustomEvent('prompts-changed', { detail: this.prompts }),
    );
  }

  /** Generates radial gradients for each prompt based on weight and color. */
  private readonly makeBackground = throttle(
    () => {
      const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

      const MAX_WEIGHT = 0.5;
      const MAX_ALPHA = 0.6;

      const bg: string[] = [];

      [...this.prompts.values()].forEach((p, i) => {
        if (p.type !== 'style') return;

        const alphaPct = clamp01(p.weight / MAX_WEIGHT) * MAX_ALPHA;
        const alpha = Math.round(alphaPct * 0xff)
          .toString(16)
          .padStart(2, '0');

        const stop = p.weight / 2;
        const x = (i % 4) / 3;
        const y = Math.floor(i / 4) / 3;
        const s = `radial-gradient(circle at ${x * 100}% ${y * 100}%, ${p.color}${alpha} 0px, ${p.color}00 ${stop * 100}%)`;

        bg.push(s);
      });

      return bg.join(', ');
    },
    30, // don't re-render more than once every XXms
  );

  private toggleShowMidi() {
    return this.setShowMidi(!this.showMidi);
  }

  public async setShowMidi(show: boolean) {
    this.showMidi = show;
    if (!this.showMidi) return;
    try {
      const inputIds = await this.midiDispatcher.getMidiAccess();
      this.midiInputIds = inputIds;
      this.activeMidiInputId = this.midiDispatcher.activeMidiInputId;
    } catch (e: any) {
      this.showMidi = false;
      this.dispatchEvent(new CustomEvent('error', {detail: e.message}));
    }
  }

  private handleMidiInputChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    const newMidiId = selectElement.value;
    this.activeMidiInputId = newMidiId;
    this.midiDispatcher.activeMidiInputId = newMidiId;
  }

  private handleMidiChannelChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    const value = selectElement.value;
    if (value === 'all') {
      this.activeMidiChannel = 'all';
    } else {
      this.activeMidiChannel = parseInt(value, 10);
    }
    this.midiDispatcher.activeMidiChannel = this.activeMidiChannel;
  }

  private playPause() {
    this.dispatchEvent(new CustomEvent('play-pause'));
  }

  public addFilteredPrompt(prompt: string) {
    this.filteredPrompts = new Set([...this.filteredPrompts, prompt]);
  }

  private randomizePrompts() {
    this.prompts.forEach((prompt) => {
      if (prompt.type === 'style') {
        prompt.weight = Math.random() * 2; // Knob range is 0-2
      }
    });
    this.requestUpdate();
    this.dispatchEvent(
      new CustomEvent('prompts-changed', { detail: new Map(this.prompts) })
    );
  }

  private resetPrompts() {
    this.prompts.forEach((prompt) => {
      if (prompt.type === 'style') {
        prompt.weight = 0;
      }
    });
    this.requestUpdate();
    this.dispatchEvent(
      new CustomEvent('prompts-changed', { detail: new Map(this.prompts) })
    );
  }

  private renderLogo() {
    return svg`
      <svg viewBox="0 0 130 24" height="24" fill="white" style="opacity: 0.9;">
        <text x="0" y="18" font-family="'Google Sans', sans-serif" font-weight="bold" font-size="22">
          Music<tspan fill="#aaa" font-weight="normal">FX</tspan>
        </text>
      </svg>`;
  }

  override render() {
    const bg = styleMap({
      backgroundImage: this.makeBackground(),
    });
    return html`<div id="background" style=${bg}></div>
      <header>
        <a id="logo" href="https://deepmind.google/technologies/lyria/" target="_blank" rel="noopener">
          ${this.renderLogo()}
        </a>
        <div id="midi-controls">
          <button @click=${this.randomizePrompts}>Randomize</button>
          <button @click=${this.resetPrompts}>Reset</button>
          <button
            @click=${this.toggleShowMidi}
            class=${this.showMidi ? 'active' : ''}>
            MIDI
          </button>
          <select
            @change=${this.handleMidiInputChange}
            .value=${this.activeMidiInputId || ''}
            style=${this.showMidi ? '' : 'visibility: hidden'}>
            ${this.midiInputIds.length > 0
              ? this.midiInputIds.map(
                  (id) => html`
                    <option value=${id}>
                      ${this.midiDispatcher.getDeviceName(id)}${id === this.activeMidiInputId ? ' (Active)' : ''}
                    </option>
                  `,
                )
              : html`<option value="">No devices found</option>`}
          </select>
          <select
            @change=${this.handleMidiChannelChange}
            .value=${String(this.activeMidiChannel)}
            style=${this.showMidi ? '' : 'visibility: hidden'}>
            <option value="all">All Channels</option>
            ${Array.from({ length: 16 }, (_, i) => i + 1).map(
              (channel) => html`<option value=${channel}>Ch. ${channel}</option>`,
            )}
          </select>
        </div>
      </header>
      <main>
        <div id="grid-container">
          <div id="grid">${this.renderPrompts('style')}</div>
        </div>
        <div id="global-controls-container">
          <h2>Global Controls</h2>
          <div id="global-controls">${this.renderPrompts('global')}</div>
        </div>
      </main>
      <footer>
        <div id="visualizer-container">
          <audio-visualizer
            .audioLevel=${this.audioLevel}
            .frequencyData=${this.frequencyData}>
          </audio-visualizer>
          <play-pause-button
            .playbackState=${this.playbackState}
            @click=${this.playPause}>
          </play-pause-button>
        </div>
      </footer>
    `;
  }

  private renderPrompts(type: 'style' | 'global') {
    const prompts = [...this.prompts.values()].filter(p => p.type === type);
    return prompts.map((prompt) => {
      return html`<prompt-controller
        promptId=${prompt.promptId}
        ?filtered=${this.filteredPrompts.has(prompt.text)}
        cc=${prompt.cc}
        text=${prompt.text}
        weight=${prompt.weight}
        color=${prompt.color}
        type=${prompt.type}
        .midiDispatcher=${this.midiDispatcher}
        .showCC=${this.showMidi}
        audioLevel=${this.audioLevel}
        @prompt-changed=${this.handlePromptChanged}>
      </prompt-controller>`;
    });
  }
}