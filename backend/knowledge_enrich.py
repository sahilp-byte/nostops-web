"""
Editorial enrichment overlay for the Yogic Paramparā registry.

Richer, historically careful descriptions for the well-documented traditions so
they carry genuine, non-thin content and qualify for indexing. Applied to
EXISTING nodes only (update description / contemporary_description); no
classification or verification state is changed here, and the 10 "Requires
Scholarly Verification" nodes are intentionally NOT enriched (they stay noindex).

Accuracy & humility over completeness: nothing uncertain is asserted as fact.
Run:  python knowledge_migrate.py enrich
"""

def _e(desc, contemporary=None):
    return {"description": desc, "contemporary_description": contemporary}

ENRICH = {
    # ── Source traditions & darśanas ──
    "vedic-tradition": _e(
        "The Vedic tradition is the oldest layer of Indian religious and contemplative culture, centred on the Vedas — Ṛg, Yajur, Sāma and Atharva — and their ritual (yajña), hymnic and cosmological vision (c. 1500–500 BCE). It established the vocabulary of sacrifice, sound and cosmic order (ṛta) from which later philosophy, meditation and yoga grew.",
        "Vedic recitation, mantra and fire ritual survive today in temple worship, saṃskāras and the chanting traditions many NOSTOPS teachers still draw upon."),
    "upanishadic-tradition": _e(
        "The Upaniṣads (c. 800–200 BCE) turn the Vedic gaze inward, replacing external sacrifice with knowledge of the self. They introduce the great equations of ātman and brahman, the syllable Oṃ, breath (prāṇa) and meditative absorption — the conceptual seedbed of both Vedānta and classical yoga.",
        "Upaniṣadic contemplation underlies most modern jñāna- and meditation-based teaching lineages."),
    "samkhya-darshana": _e(
        "Sāṃkhya is one of the six classical darśanas, a dualist enumeration of reality into puruṣa (pure consciousness) and prakṛti (nature with its three guṇas). Systematised in Īśvarakṛṣṇa's Sāṃkhya Kārikā (c. 4th c. CE), it supplies the metaphysical scaffolding that Patañjala Yoga assumes and applies.",
        "Its map of mind and matter still informs how yoga philosophy is taught worldwide."),
    "yoga-darshana": _e(
        "Pātañjala Yoga is the classical darśana codified in the Yoga Sūtras (c. 2nd–4th c. CE), defining yoga as the stilling of the movements of the mind (citta-vṛtti-nirodha) and mapping the eight limbs (aṣṭāṅga): yama, niyama, āsana, prāṇāyāma, pratyāhāra, dhāraṇā, dhyāna and samādhi. The date and identity of Patañjali are debated by scholars.",
        "It remains the single most-cited philosophical reference across modern yoga teacher training."),
    "vedanta-darshana": _e(
        "Vedānta is the family of schools that interpret the 'end of the Vedas' — the Upaniṣads, Brahma Sūtras and Bhagavad Gītā (the Prasthānatrayī). From a shared canon it branches into non-dualist, qualified-non-dualist and dualist readings of the relation between self, world and the absolute (brahman).",
        "Vedāntic enquiry anchors many contemporary jñāna-yoga and self-knowledge lineages."),
    "advaita-vedanta": _e(
        "Advaita Vedānta, expounded by Ādi Śaṅkarācārya (c. 8th c. CE), teaches strict non-dualism: brahman alone is real and the individual self (ātman) is not different from it, with the world's multiplicity attributed to māyā. Liberation comes through discriminative knowledge (jñāna) rather than ritual or works.",
        "It is the philosophical backbone of the Ramana, Chinmaya and Arsha Vidya teaching streams active today."),
    "vishishtadvaita": _e(
        "Viśiṣṭādvaita, the 'qualified non-dualism' of Rāmānuja (1017–1137 CE), holds that selves and world are real attributes of a single supreme reality (Nārāyaṇa), inseparable yet distinct. It grounds loving surrender (prapatti) and devotion within a rigorous Vedāntic framework.",
        "It remains the doctrinal core of the living Śrī Vaiṣṇava tradition."),
    "dvaita-vedanta": _e(
        "Dvaita Vedānta, founded by Madhvācārya (1238–1317 CE), affirms an eternal, real distinction between God, selves and matter. Liberation is realised through devotion and the grace of Viṣṇu, understood as fully independent reality.",
        "The Mādhva tradition continues through the Udupi maṭhas and its devotional-scholastic lineage."),
    # ── Classical yoga paths ──
    "jnana-yoga": _e(
        "Jñāna Yoga, the path of knowledge, uses discrimination (viveka) between the real and the unreal, study, reflection and meditation (śravaṇa–manana–nididhyāsana) to dissolve ignorance and realise the identity of self and absolute. It is rooted in the Upaniṣads and elaborated within Vedānta.",
        "Self-enquiry teachers and Vedānta schools carry this path forward today."),
    "bhakti-yoga": _e(
        "Bhakti Yoga is the path of loving devotion to a personal divine, systematised in texts such as the Bhagavad Gītā and the Nārada Bhakti Sūtra. Through remembrance, chanting, worship and surrender, the devotee transforms emotion into a means of liberation.",
        "It animates the kīrtan, satsaṅg and devotional practices offered by many NOSTOPS teachers."),
    "karma-yoga": _e(
        "Karma Yoga, the path of action, teaches selfless, non-attached engagement — acting without craving for the fruits of action — as taught in the Bhagavad Gītā. Work itself becomes a discipline that purifies the mind and frees the doer from egoism.",
        "Its ethic of sevā (selfless service) shapes the culture of many modern yoga institutions."),
    "raja-yoga": _e(
        "Rāja Yoga, the 'royal' path of meditation, is identified with Patañjali's eight-limbed discipline and its progressive interiorisation culminating in samādhi. The term was popularised for the modern world by Swami Vivekananda in his 1896 work of the same name.",
        "It underlies most meditation-centred modern yoga teaching."),
    # ── Haṭha / Nātha ──
    "hatha-yoga": _e(
        "Haṭha Yoga is the medieval tradition (c. 11th–15th c. CE) that developed āsana, prāṇāyāma, mudrā, bandha and the six cleansings (ṣaṭkarma) to purify and stabilise the body and subtle energy as a foundation for meditation. Emerging from Nātha and tantric milieus, it was codified in texts like the Haṭha Yoga Pradīpikā.",
        "Haṭha is the direct historical basis of most modern postural yoga taught around the world."),
    "natha-sampradaya": _e(
        "The Nātha Sampradāya is an order of ascetic yogīs, associated by tradition with Matsyendranātha and Gorakṣanātha, credited with shaping and transmitting haṭha yoga from around the 10th–12th centuries. It blended Śaiva devotion, tantra and physical-energetic discipline.",
        "Nātha ideas of the subtle body and kuṇḍalinī remain influential in contemporary yoga."),
    "gorakshanatha-tradition": _e(
        "The stream attributed to Gorakṣanātha organised Nātha practice into a coherent system of posture, breath and subtle-body technique, and is linked to a body of vernacular and Sanskrit yoga literature. Gorakṣanātha is remembered as the great systematiser of the order.",
        "Its haṭha methods flow into today's āsana and prāṇāyāma teaching."),
    "hatha-pradipika-tradition": _e(
        "The tradition of Svātmārāma's Haṭha Yoga Pradīpikā (c. 15th c. CE) presents haṭha as a four-fold path of āsana, prāṇāyāma, mudrā and nāda leading to rāja yoga. It became the most widely studied classical manual of physical yoga.",
        "It is a primary source text on nearly every serious modern yoga teacher-training syllabus."),
    "gheranda-tradition": _e(
        "The Gheraṇḍa Saṃhitā (c. 17th c. CE) teaches a seven-limbed 'ghaṭastha' yoga — cleansing, posture, mudrā, sense-withdrawal, breath, meditation and absorption — as a step-by-step 'ripening of the body'. It is one of the three classical haṭha manuals.",
        "Its cleansing (ṣaṭkarma) and prāṇāyāma techniques are still taught in traditional schools today."),
    # ── Śaiva / Śākta ──
    "kashmir-shaivism": _e(
        "Kashmir Śaivism is a non-dual tantric tradition (c. 9th–11th c. CE) that sees all reality as the self-aware vibration of a single consciousness, Śiva. Synthesised by Abhinavagupta in works such as the Tantrāloka, it integrates philosophy, aesthetics and meditative recognition (pratyabhijñā).",
        "Its teachings on awareness and subtle energy inform contemporary meditation and tantra study."),
    "trika-shaivism": _e(
        "Trika, the 'triadic' heart of Kashmir Śaivism, contemplates reality as Śiva, Śakti and the bound soul (nara), resolved in non-dual consciousness. Its scriptures include the Śiva Sūtras and Vijñāna Bhairava Tantra with its 112 meditation techniques.",
        "The Vijñāna Bhairava's dhāraṇās are widely adapted in modern meditation teaching."),
    "shaiva-siddhanta": _e(
        "Śaiva Siddhānta is a dualist Āgamic Śaiva tradition (c. 6th–12th c. CE) teaching that the soul, bound by impurity, is freed through initiation, ritual and grace to attain likeness with Śiva. Once pan-Indian, it survives most vigorously in Tamil Nadu.",
        "It continues through Tamil temple worship and its living initiatory lineages."),
    "shrividya": _e(
        "Śrīvidyā is a refined Śākta tradition of Goddess worship centred on the Śrī Yantra, the fifteen-syllable mantra and the deity Lalitā Tripurasundarī. It combines rigorous ritual, mantra science and non-dual philosophy.",
        "Its mantra and yantra practices persist in South Indian and initiatory lineages today."),
    "virashaiva": _e(
        "Vīraśaiva (Liṅgāyata) is a devotional Śaiva reform movement founded in 12th-century Karnataka around Basavaṇṇa, rejecting caste hierarchy and temple ritualism in favour of direct devotion to Śiva symbolised by the personal iṣṭaliṅga.",
        "It remains a major living community with a strong ethical and devotional culture."),
    # ── Vaiṣṇava ──
    "shri-vaishnava": _e(
        "The Śrī Vaiṣṇava sampradāya (11th–12th c. CE), shaped by Rāmānuja, unites the Tamil devotional poetry of the Āḻvārs with Viśiṣṭādvaita Vedānta, teaching surrender (prapatti) to Lakṣmī-Nārāyaṇa. It is organised around great temple centres like Śrīraṅgam.",
        "Its liturgy and lineage continue actively across South India and its diaspora."),
    "madhva-sampradaya": _e(
        "The Mādhva (Brahma) sampradāya, founded by Madhvācārya in 13th-century Karnataka, teaches dualist devotion to Viṣṇu grounded in an eternal distinction between God and soul. It centres on the Udupi Kṛṣṇa temple and its eight maṭhas.",
        "The Haridāsa devotional-musical culture flows from this living tradition."),
    "gaudiya-vaishnava": _e(
        "Gauḍīya Vaiṣṇavism, inspired by Caitanya Mahāprabhu (1486–1534 CE) in Bengal, is a tradition of ecstatic devotion to Rādhā-Kṛṣṇa centred on the chanting of the divine names (saṅkīrtana) and the theology of the Bhāgavata Purāṇa.",
        "Its kīrtan and Kṛṣṇa-devotion are practised worldwide today."),
    "pushtimarga": _e(
        "Puṣṭimārga, the 'path of grace' founded by Vallabhācārya (1479–1531 CE), is a Kṛṣṇa-devotional tradition of loving service (sevā) to the deity Śrīnāthjī, emphasising divine grace over austerity. It flourished in Braj and Gujarat.",
        "Its temple sevā, music and cuisine remain a vibrant living devotional culture."),
    "varkari-sampradaya": _e(
        "The Vārkarī tradition of Maharashtra (13th c. onward) is a devotional movement centred on the god Viṭṭhala of Pandharpur, carried by the abhaṅga poetry of sant-poets such as Jñāneśvar, Nāmdev and Tukārām and the annual pilgrimage (wārī).",
        "The Pandharpur pilgrimage and its devotional singing continue on a mass scale today."),
    # ── Buddhist / Jain contemplative ──
    "vajrayana": _e(
        "Vajrayāna is the tantric stream of Mahāyāna Buddhism (c. 7th c. CE onward) that uses deity-yoga, mantra, maṇḍala and subtle-body practice to transform ordinary experience into the path to awakening. It spread from India across the Himalaya into Tibet.",
        "Its meditation and subtle-body methods are studied worldwide in Tibetan Buddhist centres."),
    "theravada": _e(
        "Theravāda, the 'Way of the Elders', is the oldest surviving Buddhist tradition, preserving the Pāli canon and the cultivation of calm and insight (śamatha–vipassanā) toward liberation. It remains dominant across Sri Lanka and Southeast Asia.",
        "It is the direct source of the modern lay vipassanā movement."),
    "haribhadra-yoga": _e(
        "Haribhadrasūri (c. 8th c. CE) was a Jain ācārya who wrote comparative treatises on yoga, including the Yogadṛṣṭisamuccaya, mapping stages of spiritual vision across traditions. His work integrates Jain ethics and meditation with a broad yogic vocabulary.",
        "His comparative approach is valued in contemporary Jain and academic yoga study."),
    # ── Modern teacher lineages ──
    "kriya-yoga-yogananda": _e(
        "This Kriyā Yoga lineage was revived for householders by Lahiri Mahāśaya (1828–1895), transmitted through Swami Sri Yukteswar, and carried to the world by Paramahansa Yogananda, whose Autobiography of a Yogi introduced it to millions. It emphasises an energisation-and-breath technique for accelerating inner awakening.",
        "It is stewarded today by the Self-Realization Fellowship and Yogoda Satsanga Society."),
    "krishnamacharya-lineage": _e(
        "Tirumalai Krishnamacharya (1888–1989), often called the father of modern yoga, revived and reshaped āsana practice in early-20th-century Mysore. His students — B. K. S. Iyengar, K. Pattabhi Jois, T. K. V. Desikachar, Indra Devi and A. G. Mohan — seeded most globally taught postural methods.",
        "The great majority of modern āsana schools trace back to this single teaching lineage."),
    "iyengar-yoga": _e(
        "Iyengar Yoga is the modern method developed by B. K. S. Iyengar (1918–2014), a student of Krishnamacharya, distinguished by meticulous alignment, sequencing and the extensive use of props and timed holds. His 1966 book Light on Yoga became a global reference.",
        "Taught worldwide through certified teachers, it is a modern method — not an ancient paramparā."),
    "ashtanga-vinyasa": _e(
        "Ashtanga Vinyasa Yoga is the vigorous, breath-linked method of fixed posture series codified by K. Pattabhi Jois (1915–2009) from Krishnamacharya's teaching, unified by the 'tristana' of breath, bandha and gaze (dṛṣṭi). It should not be confused with Patañjali's eight-limbed aṣṭāṅga.",
        "It underpins much of the modern vinyāsa and 'flow' yoga taught globally."),
    "viniyoga": _e(
        "Viniyoga, developed by T. K. V. Desikachar (1938–2016) from his father Krishnamacharya's later teaching, adapts practice to the individual through breath-led sequencing (vinyāsa-krama) and therapeutic application. It emphasises yoga fitted to the person rather than the person fitted to yoga.",
        "It strongly shaped the contemporary yoga-therapy field."),
    "sivananda-yoga": _e(
        "Sivananda Yoga expresses the synthesis of yoga and Vedānta taught by Swami Sivananda (1887–1963) of Rishikesh, founder of the Divine Life Society. It integrates āsana, prāṇāyāma, relaxation, diet, positive thinking and meditation into a complete way of life.",
        "It is transmitted globally through the Sivananda Yoga Vedanta Centres and the Divine Life Society."),
    "satyananda-yoga": _e(
        "Satyananda Yoga (Bihar Yoga), founded by Swami Satyananda Saraswati (1923–2009) at the Bihar School of Yoga, systematised a tantra-informed approach spanning āsana, prāṇāyāma, meditation and the widely taught practice of Yoga Nidrā.",
        "Its Yoga Nidrā and structured curricula are used in studios and research settings worldwide."),
    "ramana-atma-vichara": _e(
        "The teaching of Ramana Maharshi (1879–1950), the sage of Arunachala, centres on self-enquiry (ātma-vichāra) — tracing the sense of 'I' to its source — as a direct path to realising the non-dual Self. His life and silence drew seekers from across the world.",
        "Self-enquiry in his lineage is taught and practised internationally today."),
    "sri-aurobindo-integral-yoga": _e(
        "Sri Aurobindo (1872–1950) and his collaborator known as The Mother developed Integral (Pūrṇa) Yoga in Pondicherry: a yoga aiming not at withdrawal but at the transformation of the whole being and life by a descending higher consciousness. It is distinct from Swami Satchidananda's Integral Yoga.",
        "It continues through the Sri Aurobindo Ashram and Auroville."),
    "chinmaya-vedanta": _e(
        "The Chinmaya tradition propagates systematic study of Advaita Vedānta through the teaching of Swami Chinmayananda (1916–1993), who trained under Swami Sivananda and Swami Tapovan Maharaj and built a global network of study groups.",
        "Chinmaya Mission continues worldwide Vedānta teaching and scriptural study."),
    "arsha-vidya": _e(
        "Arsha Vidya is the traditional Vedānta teaching methodology of Swami Dayananda Saraswati (1930–2015), a disciple of Swami Chinmayananda, emphasising rigorous, unfolding study of the Upaniṣads and Bhagavad Gītā in the teacher–student (guru–śiṣya) mode.",
        "It continues through Arsha Vidya Gurukulams in India and abroad."),
    "himalayan-yoga-tradition": _e(
        "The Himalayan Tradition, brought to the world by Swami Rama (1925–1996), transmits meditation, prāṇāyāma and yoga nidrā rooted in the cave-monastery teachings of the Himalayas, and became notable for early scientific studies of yogic control of the body.",
        "It continues through the Himalayan Institute and allied centres."),
    "ramakrishna-vivekananda": _e(
        "This lineage flows from the God-realised mystic Sri Ramakrishna (1836–1886) to Swami Vivekananda (1863–1902), who reframed Rāja Yoga and the four yogas for the modern age and carried Vedānta to the West at the 1893 Parliament of Religions.",
        "It continues through the worldwide Ramakrishna Math and Mission."),
    "isha-yoga": _e(
        "Isha Yoga, offered by the Isha Foundation founded by Sadhguru Jaggi Vasudev, presents classical haṭha yoga alongside guided kriyā and meditation programmes such as Inner Engineering and Shambhavi Mahamudra for contemporary practitioners.",
        "It is a widely practised modern offering rather than an ancient lineage."),
    "art-of-living": _e(
        "The Art of Living, founded by Gurudev Sri Sri Ravi Shankar in 1981, centres on the rhythmic breathing practice known as Sudarshan Kriya along with meditation and service, delivered through a global network of courses.",
        "It is a modern wellbeing methodology taught worldwide."),
    "the-yoga-institute-lineage": _e(
        "The Yoga Institute, founded by Shri Yogendra in Mumbai in 1918, is among the world's oldest organised yoga centres, pioneering yoga for the householder and for health well before yoga's global spread.",
        "It continues as an active teaching and research institution today."),
    "kaivalyadhama-lineage": _e(
        "Kaivalyadhama, founded by Swami Kuvalayananda in Lonavla in 1924, pioneered the scientific and medical study of yoga, pairing traditional practice with laboratory research on its physiological effects.",
        "It remains a leading centre for yoga research and teacher education."),
}
