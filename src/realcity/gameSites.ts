import type { GameState } from '../model';
import { LOTS } from '../data/district';

export type RealCityPosition = readonly [number, number, number];
export interface RealCityViewpoint {
  readonly position: RealCityPosition;
  readonly target: RealCityPosition;
}
export interface RealCityAnchor {
  readonly lotId: string;
  readonly coordinateSystem: 'real-shibuya-2025-v1';
  readonly tileUri: string;
  readonly batchId: number;
  readonly gmlId: string;
  readonly sourceSha256: string;
  readonly sourceUrl: string;
  readonly buildingBounds: Readonly<{ min: RealCityPosition; max: RealCityPosition }>;
  readonly markerPosition: RealCityPosition;
  readonly view: RealCityViewpoint;
}
export interface RealCitySiteState {
  readonly lotId: string;
  readonly label: string;
  readonly position: RealCityPosition;
  readonly status: 'empty' | 'store' | 'property' | 'both';
  readonly selected: boolean;
  readonly view: RealCityViewpoint;
}

/** Display-only correspondences, not real vacancies, parcels or ownership claims.
 * Source hashes match acquired PLATEAU receipts. Bounds come from original decoded
 * batch vertices in local ENU. Markers sit 6 m above the roof; they are not entrances.
 * Camera presets are authored overhead views, not surveyed ground-level viewpoints.
 */
const anchors: RealCityAnchor[] = [
  {
    "lotId": "center-01",
    "tileUri": "28709f6c49e8647bbe2f.b3dm",
    "batchId": 58,
    "gmlId": "bldg_eb2f8b5e-2878-4a15-8848-6eb36df63ff1",
    "sourceSha256": "26e32b079dce7119f2c1be285156ddc11dd2168c997bb16fb927df1056d02b8f",
    "sourceUrl": "https://assets.cms.plateau.reearth.io/assets/16/b016d3-42ef-4428-ad99-d229310b39fd/13113_shibuya-ku_pref_2025_citygml_1_op_bldg_3dtiles_13113_shibuya-ku_lod2/data/data518.b3dm",
    "coordinateSystem": "real-shibuya-2025-v1",
    "buildingBounds": {
      "min": [
        -167.47332515081942,
        2.532273795216158,
        -85.52438241498133
      ],
      "max": [
        -152.34257541388365,
        25.853651469837153,
        -71.21926064132037
      ]
    },
    "markerPosition": [
      -159.90795028235152,
      31.853651469837153,
      -78.37182152815086
    ],
    "view": {
      "position": [
        -94.90795028235152,
        170,
        11.62817847184914
      ],
      "target": [
        -159.90795028235152,
        31.853651469837153,
        -78.37182152815086
      ]
    }
  },
  {
    "lotId": "dogenzaka-01",
    "tileUri": "e68026cd64d8b5ddbe7d.b3dm",
    "batchId": 3,
    "gmlId": "bldg_14ffd32a-5f1a-4155-a02a-83a18bb69536",
    "sourceSha256": "e2cf9c519af6b02e2a78463595791fb57f1b518cb73ed038c39261aefb6def44",
    "sourceUrl": "https://assets.cms.plateau.reearth.io/assets/16/b016d3-42ef-4428-ad99-d229310b39fd/13113_shibuya-ku_pref_2025_citygml_1_op_bldg_3dtiles_13113_shibuya-ku_lod2/data/data519.b3dm",
    "coordinateSystem": "real-shibuya-2025-v1",
    "buildingBounds": {
      "min": [
        -251.94945068379093,
        7.080389407733646,
        60.6324479939023
      ],
      "max": [
        -235.54949054428545,
        46.07049429060582,
        81.24491804326132
      ]
    },
    "markerPosition": [
      -243.7494706140382,
      52.07049429060582,
      70.93868301858181
    ],
    "view": {
      "position": [
        -178.7494706140382,
        170,
        160.9386830185818
      ],
      "target": [
        -243.7494706140382,
        52.07049429060582,
        70.93868301858181
      ]
    }
  },
  {
    "lotId": "miyashita-01",
    "tileUri": "8a5d9064182b062502fc.b3dm",
    "batchId": 15,
    "gmlId": "bldg_77de016a-7fe8-4a3a-8237-e306681dd91e",
    "sourceSha256": "2909ffc004c4059da645c5e95d4cee0178d39a66540a7c1d6bae6ef76a4d515e",
    "sourceUrl": "https://assets.cms.plateau.reearth.io/assets/16/b016d3-42ef-4428-ad99-d229310b39fd/13113_shibuya-ku_pref_2025_citygml_1_op_bldg_3dtiles_13113_shibuya-ku_lod2/data/data473.b3dm",
    "coordinateSystem": "real-shibuya-2025-v1",
    "buildingBounds": {
      "min": [
        113.3877825866537,
        2.480308652024167,
        -110.34465067527049
      ],
      "max": [
        140.21102392220723,
        43.553040701911826,
        -100.4478596343379
      ]
    },
    "markerPosition": [
      126.79940325443047,
      49.553040701911826,
      -105.3962551548042
    ],
    "view": {
      "position": [
        191.79940325443047,
        170,
        -15.396255154804194
      ],
      "target": [
        126.79940325443047,
        49.553040701911826,
        -105.3962551548042
      ]
    }
  },
  {
    "lotId": "sakuragaoka-01",
    "tileUri": "5011c220cb411c00d04b.b3dm",
    "batchId": 26,
    "gmlId": "bldg_a8c45232-2cd2-47fa-99a3-00d87e114687",
    "sourceSha256": "b299b52f9ccca421a546d4b22eda28765a4ed7843c014f1aa80e9731b02df821",
    "sourceUrl": "https://assets.cms.plateau.reearth.io/assets/16/b016d3-42ef-4428-ad99-d229310b39fd/13113_shibuya-ku_pref_2025_citygml_1_op_bldg_3dtiles_13113_shibuya-ku_lod2/data/data528.b3dm",
    "coordinateSystem": "real-shibuya-2025-v1",
    "buildingBounds": {
      "min": [
        -46.511651429359446,
        7.811264671531404,
        291.3423828622268
      ],
      "max": [
        -27.187864731663637,
        26.070801492107826,
        310.82638525448976
      ]
    },
    "markerPosition": [
      -36.84975808051154,
      32.070801492107826,
      301.0843840583583
    ],
    "view": {
      "position": [
        28.150241919488458,
        170,
        391.0843840583583
      ],
      "target": [
        -36.84975808051154,
        32.070801492107826,
        301.0843840583583
      ]
    }
  }
];
for (const anchor of anchors) {
  Object.freeze(anchor.buildingBounds.min); Object.freeze(anchor.buildingBounds.max); Object.freeze(anchor.buildingBounds);
  Object.freeze(anchor.markerPosition); Object.freeze(anchor.view.position); Object.freeze(anchor.view.target); Object.freeze(anchor.view); Object.freeze(anchor);
}
export const REAL_CITY_ANCHORS: readonly RealCityAnchor[] = Object.freeze(anchors);

export function hasRealCityAnchor(lotId: string): boolean {
  return REAL_CITY_ANCHORS.some(anchor => anchor.lotId === lotId);
}
const copyPosition = (position: RealCityPosition): RealCityPosition => [position[0], position[1], position[2]];

/** Derive only the four display sites. All 32 economic lots remain in LOTS unchanged. */
export function getRealCitySites(state: GameState, selectedLotId: string | null = null): readonly RealCitySiteState[] {
  return REAL_CITY_ANCHORS.map(anchor => {
    const lot = LOTS.find(candidate => candidate.id === anchor.lotId)!;
    const store = state.stores.find(candidate => candidate.lotId === anchor.lotId);
    const property = state.properties.some(candidate => candidate.lotId === anchor.lotId);
    return {
      lotId: anchor.lotId, label: store?.name ?? lot.name,
      position: copyPosition(anchor.markerPosition),
      status: store ? property ? 'both' : 'store' : property ? 'property' : 'empty',
      selected: selectedLotId === anchor.lotId,
      view: { position: copyPosition(anchor.view.position), target: copyPosition(anchor.view.target) },
    };
  });
}
