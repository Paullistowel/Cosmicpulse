"""Classify BodyParts3D meshes into CosmicPulse anatomical structures.

Input: parts_list_e.txt (id\tname) and stlsizes.json ({id: bytes}) from the
BodyParts3D repository. Output: manifest.json {structure: {system, layer, label, ids: [...]}}.
Run: python3 -I classify.py <workdir>
"""
import json, re, sys, os

wd = sys.argv[1]
names = {}
for line in open(os.path.join(wd, 'parts_list_e.txt'), encoding='utf-8'):
    p = line.rstrip('\n').split('\t')
    if len(p) >= 2:
        names[p[0]] = p[1].strip()
sizes = json.load(open(os.path.join(wd, 'stlsizes.json')))

SUPERFICIAL = (r'pectoralis major|deltoid|biceps|triceps|brachioradialis|brachialis|extensor carpi|flexor carpi|extensor digitorum$|'
    r'palmaris longus|rectus abdominis|external oblique|serratus anterior|latissimus|trapezius|sternocleidomastoid|'
    r'gluteus maximus|gluteus medius|rectus femoris|vastus lateralis|vastus medialis|sartorius|gracilis|adductor longus|adductor magnus|'
    r'tensor fasciae|iliotibial|biceps femoris|semitendinosus|semimembranosus|gastrocnemius|soleus|tibialis anterior|'
    r'fibularis longus|extensor digitorum longus|temporalis|masseter|frontalis|occipitalis|infraspinatus|teres major|'
    r'rhomboid major|splenius capitis|levator scapulae|pronator teres|orbicularis|zygomaticus|external intercostal')

# (structure, system, layer, label, regex) — first match wins; order matters.
RULES = [
    ('skin', 'body', 'skin', 'Skin', r'^skin$'),
    ('eyes', 'neuro', 'organs', 'Eyes', r'eyeball'),
    ('heart', 'cardiovascular', 'organs', 'Heart', r'wall of heart|papillary|valve|chordae|coronary|interventricular|cardiac vein|marginal branch|posterolateral branch|anterior cardiac|posterior veins of|septal branches|circumflex'),
    ('veins', 'cardiovascular', 'vessels', 'Major veins', r'vena cava|vein'),
    ('arteries', 'cardiovascular', 'vessels', 'Major arteries', r'aorta|arter|brachiocephalic|pulmonary trunk'),
    ('lungs', 'respiratory', 'organs', 'Lungs', r'lobe of (left |right )?lung|middle lobe of lung'),
    ('airway', 'respiratory', 'organs', 'Airway', r'trachea|bronchus|thyroid cartilage|larynx'),
    ('diaphragm', 'respiratory', 'organs', 'Diaphragm', r'^diaphragm$'),
    ('brain', 'neuro', 'organs', 'Brain', r'gyrus|gyri|collicul|geniculate|globus pallidus|occipital lobe|optic tract|habenula|mammillary|lamina terminalis|interpeduncular|anterior commissure|stria terminalis|internal capsule|cerebell|cerebral|thalam|hypothalamus|midbrain|pons|medulla oblongata|fornix|insula|lobule|hippocamp|choroid plexus|aqueduct|superior frontal|superior temporal|stria medullaris|caudate|putamen|amygdala|corpus callosum|ventricle of brain|lateral ventricle|third ventricle|fourth ventricle'),
    ('spinalcord', 'neuro', 'organs', 'Spinal cord', r'spinal cord'),
    ('liver', 'metabolic', 'organs', 'Liver', r'^liver$|gallbladder'),
    ('stomach', 'metabolic', 'organs', 'Stomach', r'^stomach$|esophagus'),
    ('intestines', 'metabolic', 'organs', 'Intestines', r'duodenum|jejunum|ileum|colon|rectum|cecum|appendix'),
    ('pancreas', 'metabolic', 'organs', 'Pancreas', r'pancrea'),
    ('kidneys', 'metabolic', 'organs', 'Kidneys', r'kidney|adrenal|ureter|urinary bladder'),
    ('spleen', 'immune', 'organs', 'Spleen', r'spleen'),
    ('thymus', 'immune', 'organs', 'Thymus', r'thymus'),
    ('skeleton', 'musculoskeletal', 'skeleton', 'Skeleton', r'bone|vertebra|rib$|\brib\b|sternum|manubrium|xiphoid|clavicle|scapula|humerus|radius|ulna|femur|tibia|fibula|patella|sacrum|coccyx|mandible|maxilla|phalanx|metacarpal|metatarsal|carpal|tarsal|talus|calcaneus|cuboid|cuneiform|navicular|scaphoid|lunate|triquetrum|pisiform|trapezi|capitate|hamate|sesamoid|costal cartilage|tooth|atlas|axis|hyoid|vomer|ethmoid|sphenoid|nasal cartilage|occipital bone|parietal bone|frontal bone|temporal bone|zygomatic|palatine|lacrimal|concha|meniscus|intervertebral'),
    ('muscles', 'musculoskeletal', 'muscles', 'Muscles', SUPERFICIAL),
]
EXCLUDE = r'nerve|plexus of|ganglion|tendon|ligament|\bfascia\b|aponeurosis|retinaculum|membrane|eyebrow|canal|\bduct\b|deferent|tendinous arch|bursa|joint|sheath|penis|testis|epididymis|seminal|ear$|gingiva|taenia|linea alba|labial part|anal sphincter|aqueduct'

manifest = {}
skipped = []
for fid, size in sizes.items():
    n = names.get(fid)
    if not n:
        skipped.append((fid, '?')); continue
    low = n.lower()
    if re.search(EXCLUDE, low) and not re.search(r'choroid plexus', low):
        skipped.append((fid, n)); continue
    for key, system, layer, label, rx in RULES:
        if re.search(rx, low):
            s = manifest.setdefault(key, {'system': system, 'layer': layer, 'label': label, 'ids': [], 'bytes': 0, 'names': []})
            s['ids'].append(fid); s['bytes'] += size; s['names'].append(n)
            break

json.dump(manifest, open(os.path.join(wd, 'manifest.json'), 'w'), indent=1)
tot = 0
for k, s in manifest.items():
    tot += s['bytes']
    print(f"{k:12} {len(s['ids']):4} parts {s['bytes']/1e6:8.1f} MB")
print(f"total {tot/1e6:.1f} MB; skipped {len(skipped)}")
if '-v' in sys.argv:
    for k in sys.argv[2:]:
        if k in manifest: print(k, sorted(manifest[k]['names']))
    print('SKIPPED', sorted(x[1] for x in skipped))
