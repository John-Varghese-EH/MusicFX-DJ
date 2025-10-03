/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';

const BAR_COUNT = 64; // Number of frequency bars to display

@customElement('audio-visualizer')
// FIX: The class must extend LitElement to be a custom element.
export class AudioVisualizer extends LitElement {
  static override styles = css`
    :host {
      display: block;
      position: relative;
      width: 100%;
      height: 100%;
    }
    svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg); /* Start bars from the top */
    }
    #background-circle {
      transition: r 0.1s ease-out;
    }
    .bar {
      stroke: #fff;
      stroke-linecap: round;
      transition: all 0.05s ease-out;
      mix-blend-mode: lighten;
    }
    #glow {
        will-change: filter;
    }
  `;

  @property({ type: Number })
  audioLevel = 0;

  @property({ type: Object })
  frequencyData: Uint8Array = new Uint8Array(0);

  private polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
    const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  }


  override render() {
    const size = 140; // SVG viewbox size
    const center = size / 2;
    const baseRadius = 50; // Radius of the inner circle where bars start

    const bars = [];
    if (this.frequencyData.length > 0) {
        const angleStep = 360 / BAR_COUNT;
        const dataStep = Math.floor(this.frequencyData.length / BAR_COUNT);

        for (let i = 0; i < BAR_COUNT; i++) {
            const angle = angleStep * i;

            // Average the frequency data for the current bar
            let dataSum = 0;
            for (let j = 0; j < dataStep; j++) {
                dataSum += this.frequencyData[i * dataStep + j] || 0;
            }
            const dataValue = dataStep > 0 ? dataSum / dataStep : 0;
            
            const barHeight = (dataValue / 255) * 25; // Max bar height
            const opacity = dataValue / 255;

            const start = this.polarToCartesian(center, center, baseRadius, angle);
            const end = this.polarToCartesian(center, center, baseRadius + barHeight, angle);

            bars.push(svg`
            <line
                class="bar"
                x1=${start.x} y1=${start.y}
                x2=${end.x} y2=${end.y}
                stroke-width=${2 + (opacity * 2)}
                stroke-opacity=${opacity}
            />`);
        }
    }
    
    // Pulse the background circle glow with the overall audio level
    const glowRadius = 45 + (this.audioLevel * 15);

    return html`
      <svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <filter id="glow-filter">
                <feGaussianBlur stdDeviation=${2 + this.audioLevel * 4} result="coloredBlur" />
                <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>
        <g id="glow" filter="url(#glow-filter)">
            <circle id="background-circle" cx=${center} cy=${center} r=${glowRadius} fill="none" stroke="#5200ff" stroke-width="2" stroke-opacity="0.5" />
            ${bars}
        </g>
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'audio-visualizer': AudioVisualizer;
  }
}