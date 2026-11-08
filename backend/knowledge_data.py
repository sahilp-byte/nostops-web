"""
NOSTOPS Yogic Paramparā Master Registry — curated seed data.

HISTORICAL-INTEGRITY RULES honoured throughout:
  • Every node has an explicit `classification`. A modern method/organisation is
    NEVER labelled an ancient Paramparā.
  • No fabricated Guru–disciple links. Traditional/mythic attributions are marked
    verification="Requires Scholarly Verification" (or "Historically Documented"
    with confidence Low), never asserted as fact.
  • Foreign-key references (ids) are used instead of duplicated text.

ids are human-readable and deterministic (id == slug for paramparas; g-*/s-*/
pr-*/m-*/i-*/src-* for the other entities) so the seed is idempotent.
"""

# ─────────────────────────────── SOURCES ────────────────────────────────────
def S(key, title, author=None, year=None, kind="secondary", note=None):
    return {"id": f"src-{key}", "key": key, "title": title, "author": author,
            "year": year, "kind": kind, "note": note}

SOURCES = [
    S("roots-of-yoga", "Roots of Yoga", "James Mallinson & Mark Singleton", 2017, note="Penguin Classics — annotated primary-source anthology"),
    S("yoga-tradition", "The Yoga Tradition", "Georg Feuerstein", 1998),
    S("yoga-body", "Yoga Body: The Origins of Modern Posture Practice", "Mark Singleton", 2010),
    S("yoga-sutras-bryant", "The Yoga Sūtras of Patañjali", "Edwin F. Bryant", 2009, kind="primary-translation"),
    S("alchemical-body", "The Alchemical Body: Siddha Traditions in Medieval India", "David Gordon White", 1996),
    S("saiva-age", "The Śaiva Age", "Alexis Sanderson", 2009),
    S("intro-hinduism", "An Introduction to Hinduism", "Gavin Flood", 1996),
    S("classical-samkhya", "Classical Sāṃkhya", "Gerald James Larson", 1979),
    S("doctrine-of-vibration", "The Doctrine of Vibration", "Mark S. G. Dyczkowski", 1987),
    S("encyclopedia-hinduism", "Brill's Encyclopedia of Hinduism", "Knut A. Jacobsen (ed.)", 2009),
    S("hyp", "Haṭha Yoga Pradīpikā (Svātmārāma)", "Svātmārāma", 1450, kind="primary-text"),
    S("gheranda-samhita", "Gheraṇḍa Saṃhitā", None, 1700, kind="primary-text"),
    S("shiva-samhita", "Śiva Saṃhitā", None, 1500, kind="primary-text"),
    S("autobiography-yogi", "Autobiography of a Yogi", "Paramahansa Yogananda", 1946, kind="primary"),
    S("light-on-yoga", "Light on Yoga", "B. K. S. Iyengar", 1966, kind="primary"),
    S("yoga-mala", "Yoga Mala", "K. Pattabhi Jois", 1962, kind="primary"),
    S("heart-of-yoga", "The Heart of Yoga", "T. K. V. Desikachar", 1995, kind="primary"),
    S("living-himalayan-masters", "Living with the Himalayan Masters", "Swami Rama", 1978, kind="primary"),
    S("tantraloka", "Tantrāloka (Abhinavagupta)", "Abhinavagupta", 1000, kind="primary-text"),
    S("sinister-yogis", "Sinister Yogis", "David Gordon White", 2009),
]

# ─────────────────────────────── GURUS ──────────────────────────────────────
def G(slug, cn, period, alt=None, tradition=None, geo=None, bio=None,
      verification="Historically Documented", confidence="Medium", sources=None):
    return {"id": f"g-{slug}", "slug": slug, "canonical_name": cn,
            "alternate_names": alt or [], "period": period, "tradition": tradition,
            "geographical_association": geo, "biography": bio,
            "verification_status": verification, "confidence_level": confidence,
            "source_ids": [f"src-{x}" for x in (sources or [])]}

GURUS = [
    G("patanjali", "Maharishi Patañjali", "c. 2nd c. BCE – 4th c. CE", alt=["Patañjali"], tradition="Pātañjala Yoga", geo="India (textual)", bio="Compiler of the Yoga Sūtras; date and identity debated by scholars.", verification="Requires Scholarly Verification", confidence="Low", sources=["yoga-sutras-bryant","roots-of-yoga"]),
    G("vyasa-bhashyakara", "Vyāsa (Yoga-bhāṣya author)", "c. 4th–5th c. CE", tradition="Pātañjala Yoga", bio="Author of the earliest surviving commentary (bhāṣya) on the Yoga Sūtras.", confidence="Low", sources=["yoga-sutras-bryant"]),
    G("adi-shankara", "Ādi Śaṅkarācārya", "c. 8th c. CE", alt=["Shankara","Śaṅkara"], tradition="Advaita Vedānta", geo="Kaladi, Kerala → Śṛṅgeri/Badrī/Purī/Dwārakā", bio="Exponent of Advaita Vedānta; organised the Daśanāmī monastic order.", verification="Historically Documented", confidence="Medium", sources=["intro-hinduism"]),
    G("ramanuja", "Rāmānujācārya", "1017–1137 CE", tradition="Śrī Vaiṣṇava", geo="Śrīraṅgam, Tamil Nadu", bio="Principal ācārya of Viśiṣṭādvaita and the Śrī Vaiṣṇava tradition.", verification="Historically Documented", confidence="High", sources=["intro-hinduism"]),
    G("madhva", "Madhvācārya", "1238–1317 CE", alt=["Ānandatīrtha"], tradition="Dvaita Vedānta", geo="Udupi, Karnataka", bio="Founder of the Dvaita (dualist) Vedānta school.", verification="Historically Documented", confidence="High", sources=["intro-hinduism"]),
    G("matsyendranath", "Matsyendranātha", "c. 10th c. CE", alt=["Macchindranāth"], tradition="Nātha Sampradāya", geo="Bengal / Nepal", bio="Revered as an originary Nātha master; historicity partly legendary.", verification="Requires Scholarly Verification", confidence="Low", sources=["alchemical-body","roots-of-yoga"]),
    G("gorakshanath", "Gorakṣanātha", "c. 11th–12th c. CE", alt=["Gorakhnath"], tradition="Nātha Sampradāya", geo="Gorakhpur / Himalaya", bio="Systematiser of the Nātha order and haṭha techniques; disciple of Matsyendranātha by tradition.", verification="Historically Documented", confidence="Medium", sources=["alchemical-body","roots-of-yoga"]),
    G("svatmarama", "Svātmārāma", "c. 15th c. CE", tradition="Haṭha Yoga", bio="Compiler of the Haṭha Yoga Pradīpikā.", confidence="Medium", sources=["hyp"]),
    G("vasugupta", "Vasugupta", "c. 850 CE", tradition="Kashmir Śaivism", geo="Kashmir", bio="Associated with the revelation of the Śiva Sūtras.", verification="Historically Documented", confidence="Medium", sources=["doctrine-of-vibration"]),
    G("abhinavagupta", "Abhinavagupta", "c. 950–1016 CE", tradition="Trika / Kashmir Śaivism", geo="Kashmir", bio="Polymath master of Trika Śaivism; author of the Tantrāloka.", verification="Historically Documented", confidence="High", sources=["tantraloka","saiva-age"]),
    G("basavanna", "Basavaṇṇa", "1131–1167 CE", tradition="Vīraśaiva / Liṅgāyata", geo="Karnataka", bio="Central figure of the Vīraśaiva bhakti movement.", verification="Historically Documented", confidence="High", sources=["intro-hinduism"]),
    G("vallabha", "Vallabhācārya", "1479–1531 CE", tradition="Puṣṭimārga", geo="Braj / Gujarat", bio="Founder of the Puṣṭimārga (Vallabha) Vaiṣṇava school.", verification="Historically Documented", confidence="High", sources=["intro-hinduism"]),
    G("nimbarka", "Nimbārkācārya", "c. 12th–13th c. CE", tradition="Nimbārka Sampradāya", geo="Braj", bio="Founder of the Nimbārka (dvaitādvaita) Vaiṣṇava lineage.", confidence="Low", verification="Requires Scholarly Verification", sources=["intro-hinduism"]),
    G("chaitanya", "Caitanya Mahāprabhu", "1486–1534 CE", tradition="Gauḍīya Vaiṣṇava", geo="Bengal / Purī", bio="Inspirer of the Gauḍīya Vaiṣṇava bhakti movement.", verification="Historically Documented", confidence="High", sources=["intro-hinduism"]),
    G("ramananda", "Rāmānanda", "c. 14th–15th c. CE", tradition="Rāmānandī", geo="Varanasi", bio="Traditionally the founder of the Rāmānandī order.", confidence="Low", verification="Requires Scholarly Verification", sources=["intro-hinduism"]),
    G("haribhadra", "Haribhadrasūri", "c. 8th c. CE", tradition="Jain Yoga", bio="Jain ācārya; author of yoga treatises incl. Yogadṛṣṭisamuccaya.", confidence="Medium", sources=["encyclopedia-hinduism"]),
    G("lahiri-mahasaya", "Lahiri Mahāśaya", "1828–1895", tradition="Kriyā Yoga", geo="Varanasi", bio="Revived and taught Kriyā Yoga to householders.", verification="Historically Documented", confidence="High", sources=["autobiography-yogi"]),
    G("sri-yukteswar", "Swami Sri Yukteswar", "1855–1936", tradition="Kriyā Yoga", geo="Serampore, Bengal", bio="Disciple of Lahiri Mahāśaya; guru of Yogananda.", verification="Historically Documented", confidence="High", sources=["autobiography-yogi"]),
    G("yogananda", "Paramahansa Yogananda", "1893–1952", tradition="Kriyā Yoga", geo="India → USA", bio="Brought Kriyā Yoga to the West; founded SRF/YSS.", verification="Historically Documented", confidence="High", sources=["autobiography-yogi"]),
    G("krishnamacharya", "Tirumalai Krishnamacharya", "1888–1989", tradition="Modern postural yoga", geo="Mysore / Chennai", bio="Teacher of Iyengar, Pattabhi Jois, Desikachar, Indra Devi; a fountainhead of modern āsana.", verification="Historically Documented", confidence="High", sources=["yoga-body"]),
    G("bks-iyengar", "B. K. S. Iyengar", "1918–2014", tradition="Iyengar Yoga", geo="Pune", bio="Developed alignment- and prop-based method; author of Light on Yoga.", verification="Historically Documented", confidence="High", sources=["light-on-yoga","yoga-body"]),
    G("pattabhi-jois", "K. Pattabhi Jois", "1915–2009", tradition="Ashtanga Vinyasa", geo="Mysore", bio="Codified the Ashtanga Vinyasa method from Krishnamacharya's teaching.", verification="Historically Documented", confidence="High", sources=["yoga-mala","yoga-body"]),
    G("desikachar", "T. K. V. Desikachar", "1938–2016", tradition="Viniyoga", geo="Chennai", bio="Son of Krishnamacharya; developed the individualised Viniyoga approach.", verification="Historically Documented", confidence="High", sources=["heart-of-yoga"]),
    G("ag-mohan", "A. G. Mohan", "b. 1945", tradition="Krishnamacharya lineage", geo="Chennai", bio="Direct student of Krishnamacharya; co-founder of Svastha Yoga.", verification="Historically Documented", confidence="High"),
    G("sivananda", "Swami Sivananda Saraswati", "1887–1963", tradition="Sivananda / Vedānta", geo="Rishikesh", bio="Founder of the Divine Life Society; teacher of many 20th-c. masters.", verification="Historically Documented", confidence="High"),
    G("satyananda", "Swami Satyananda Saraswati", "1923–2009", tradition="Satyananda / Bihar Yoga", geo="Munger, Bihar", bio="Disciple of Sivananda; founded the Bihar School of Yoga; systematised Yoga Nidrā.", verification="Historically Documented", confidence="High"),
    G("vishnudevananda", "Swami Vishnudevananda", "1927–1993", tradition="Sivananda Yoga", geo="India → Canada", bio="Disciple of Sivananda; founded the Sivananda Yoga Vedanta Centres.", verification="Historically Documented", confidence="High"),
    G("satchidananda", "Swami Satchidananda", "1914–2002", tradition="Integral Yoga", geo="India → USA", bio="Disciple of Sivananda; founded Integral Yoga and Yogaville.", verification="Historically Documented", confidence="High"),
    G("swami-rama", "Swami Rama", "1925–1996", tradition="Himalayan Tradition", geo="Himalaya / USA", bio="Founder of the Himalayan Institute; taught meditation & yoga nidrā.", verification="Historically Documented", confidence="High", sources=["living-himalayan-masters"]),
    G("ramakrishna", "Sri Ramakrishna Paramahamsa", "1836–1886", tradition="Vedānta / Śākta", geo="Dakshineswar, Bengal", bio="Mystic whose teaching inspired the Ramakrishna movement.", verification="Historically Documented", confidence="High"),
    G("vivekananda", "Swami Vivekananda", "1863–1902", tradition="Rāja Yoga (Vedānta)", geo="Kolkata", bio="Disciple of Ramakrishna; reframed Rāja Yoga for the modern world.", verification="Historically Documented", confidence="High"),
    G("aurobindo", "Sri Aurobindo", "1872–1950", tradition="Integral (Pūrṇa) Yoga", geo="Pondicherry", bio="Developed Integral Yoga; co-worker 'The Mother'.", verification="Historically Documented", confidence="High"),
    G("ramana", "Ramana Maharshi", "1879–1950", tradition="Ātma-vichāra / Advaita", geo="Tiruvannamalai", bio="Sage of Arunachala; taught self-enquiry (ko'ham / ātma-vichāra).", verification="Historically Documented", confidence="High"),
    G("chinmayananda", "Swami Chinmayananda", "1916–1993", tradition="Vedānta", geo="India", bio="Founder of Chinmaya Mission; studied under Sivananda and Tapovan Maharaj.", verification="Historically Documented", confidence="High"),
    G("tapovan", "Swami Tapovan Maharaj", "1889–1957", tradition="Vedānta", geo="Uttarkashi", bio="Vedānta master; guru of Chinmayananda.", verification="Historically Documented", confidence="Medium"),
    G("dayananda-saraswati", "Swami Dayananda Saraswati (Arsha Vidya)", "1930–2015", tradition="Advaita Vedānta", geo="Coimbatore / Rishikesh", bio="Traditional Vedānta teacher; disciple of Chinmayananda; founded Arsha Vidya Gurukulam.", verification="Historically Documented", confidence="High"),
    G("sadhguru", "Sadhguru (Jaggi Vasudev)", "b. 1957", tradition="Isha Yoga", geo="Coimbatore", bio="Founder of the Isha Foundation; teaches classical haṭha and Inner Engineering.", verification="Historically Documented", confidence="High"),
    G("sri-sri", "Gurudev Sri Sri Ravi Shankar", "b. 1956", tradition="Art of Living", geo="Bengaluru", bio="Founder of the Art of Living; introduced Sudarshan Kriya.", verification="Historically Documented", confidence="High"),
    G("yogi-bhajan", "Yogi Bhajan (Harbhajan Singh Khalsa)", "1929–2004", tradition="Kundalini Yoga (3HO)", geo="Punjab → USA", bio="Introduced 'Kundalini Yoga as taught by Yogi Bhajan'; founded 3HO.", verification="Historically Documented", confidence="Medium"),
    G("kripalvananda", "Swami Kripalvananda", "1913–1981", alt=["Bapuji"], tradition="Kripalu Yoga", geo="Gujarat", bio="Namesake of Kripalu Yoga; teacher of Amrit Desai.", verification="Historically Documented", confidence="Medium"),
    G("anandamurti", "Shrii Shrii Ānandamūrti (P. R. Sarkar)", "1921–1990", tradition="Ananda Marga", geo="Bengal", bio="Founder of Ananda Marga; taught tantric meditation and Neohumanism.", verification="Historically Documented", confidence="High"),
    G("yogendra", "Shri Yogendra", "1897–1989", tradition="The Yoga Institute", geo="Mumbai", bio="Founder of The Yoga Institute (1918); pioneer of yoga for householders.", verification="Historically Documented", confidence="High"),
    G("kuvalayananda", "Swami Kuvalayananda", "1883–1966", tradition="Kaivalyadhama", geo="Lonavla", bio="Founder of Kaivalyadhama; pioneer of scientific research on yoga.", verification="Historically Documented", confidence="High"),
    G("maharishi-mahesh", "Maharishi Mahesh Yogi", "1918–2008", tradition="Transcendental Meditation", geo="India → worldwide", bio="Introduced Transcendental Meditation (TM).", verification="Historically Documented", confidence="High"),
    G("goenka", "S. N. Goenka", "1924–2013", tradition="Vipassana (Goenka)", geo="Myanmar → India", bio="Popularised Vipassanā in the U Ba Khin tradition worldwide.", verification="Historically Documented", confidence="High"),
    # ── Disciples added for lineage-timeline coverage (well-documented) ──
    G("geeta-iyengar", "Geeta S. Iyengar", "1944–2018", tradition="Iyengar Yoga", geo="Pune", bio="Daughter and foremost student of B. K. S. Iyengar; leading authority on yoga for women (author of 'Yoga: A Gem for Women').", verification="Historically Documented", confidence="High", sources=["yoga-body"]),
    G("prashant-iyengar", "Prashant S. Iyengar", "b. 1949", tradition="Iyengar Yoga", geo="Pune", bio="Son and senior student of B. K. S. Iyengar; teacher and author on the philosophy and inner practice of āsana.", verification="Historically Documented", confidence="High"),
    G("sharath-jois", "R. Sharath Jois", "1971–2024", tradition="Ashtanga Vinyasa", geo="Mysore", bio="Grandson and designated successor of K. Pattabhi Jois; lineage holder of Ashtanga Vinyasa in Mysore.", verification="Historically Documented", confidence="High", sources=["yoga-body"]),
    G("manju-jois", "Manju Pattabhi Jois", "b. 1944", tradition="Ashtanga Vinyasa", geo="Mysore → USA", bio="Eldest son of K. Pattabhi Jois; among the first to teach the Ashtanga Vinyasa method in the West.", verification="Historically Documented", confidence="High"),
    G("indra-devi", "Indra Devi", "1899–2002", alt=["Eugenie Peterson"], tradition="Modern postural yoga", geo="Russia → India → USA/Argentina", bio="Early Western student of Krishnamacharya; a pioneering woman who spread yoga worldwide ('First Lady of Yoga').", verification="Historically Documented", confidence="High", sources=["yoga-body"]),
    G("niranjanananda", "Swami Niranjanananda Saraswati", "b. 1960", tradition="Satyananda / Bihar Yoga", geo="Munger, Bihar", bio="Successor of Swami Satyananda; head of the Bihar School of Yoga and Bihar Yoga Bharati.", verification="Historically Documented", confidence="High"),
    G("rajarshi-janakananda", "Rajarshi Janakananda (James J. Lynn)", "1892–1955", tradition="Kriyā Yoga", geo="USA", bio="Foremost American disciple of Paramahansa Yogananda; second president of Self-Realization Fellowship.", verification="Historically Documented", confidence="High", sources=["autobiography-yogi"]),
    G("daya-mata", "Sri Daya Mata", "1914–2010", alt=["Faye Wright"], tradition="Kriyā Yoga", geo="USA", bio="Direct disciple of Paramahansa Yogananda; long-serving president of Self-Realization Fellowship.", verification="Historically Documented", confidence="High", sources=["autobiography-yogi"]),
    G("rajmani-tigunait", "Pandit Rajmani Tigunait", "b. 1953", tradition="Himalayan Tradition", geo="India → USA", bio="Successor of Swami Rama; spiritual head of the Himalayan Institute.", verification="Historically Documented", confidence="High", sources=["living-himalayan-masters"]),
    G("brahmananda", "Swami Brahmananda (Rakhal)", "1863–1922", tradition="Vedānta / Ramakrishna Order", geo="Bengal", bio="Direct disciple of Ramakrishna; first president of the Ramakrishna Math and Mission.", verification="Historically Documented", confidence="High"),
    G("padmapada", "Padmapāda", "c. 8th c. CE", tradition="Advaita Vedānta", geo="India (Purī maṭha, by tradition)", bio="Traditionally one of the four principal disciples of Ādi Śaṅkara; author of the Pañcapādikā.", verification="Requires Scholarly Verification", confidence="Low", sources=["intro-hinduism"]),
    G("sureshvara", "Sureśvara", "c. 8th c. CE", tradition="Advaita Vedānta", geo="India (Śṛṅgeri maṭha, by tradition)", bio="Traditionally a principal disciple of Ādi Śaṅkara; author of the vārttikas on Śaṅkara's commentaries.", verification="Requires Scholarly Verification", confidence="Low", sources=["intro-hinduism"]),
    G("hastamalaka", "Hastāmalaka", "c. 8th c. CE", tradition="Advaita Vedānta", geo="India (Dwārakā maṭha, by tradition)", bio="Traditionally one of the four principal disciples of Ādi Śaṅkara; namesake of the Hastāmalaka-stotra.", verification="Requires Scholarly Verification", confidence="Low", sources=["intro-hinduism"]),
    G("totakacharya", "Toṭakācārya", "c. 8th c. CE", tradition="Advaita Vedānta", geo="India (Jyotir/Badrī maṭha, by tradition)", bio="Traditionally a principal disciple of Ādi Śaṅkara; author of the Toṭakāṣṭaka.", verification="Requires Scholarly Verification", confidence="Low", sources=["intro-hinduism"]),
]

# Guru portrait metadata (Wikimedia Commons, freely licensed) — applied by
# bootstrap content-v3 so portraits land in every environment. Images live in
# shared object storage under /bff/media/retreats/_gurus/*.
GURU_PORTRAITS = {
    "anandamurti": {"portrait_credit": "Ananda Marga Pracaraka Samgha", "portrait_license": "CC BY-SA 3.0", "portrait_license_url": "https://creativecommons.org/licenses/by-sa/3.0", "portrait_source": "Wikimedia Commons", "portrait_source_url": "https://commons.wikimedia.org/wiki/File:PRSarkar_GentlemanPhoto_3.jpg", "portrait_url": "/bff/media/retreats/_gurus/anandamurti.jpg"},
    "aurobindo": {"portrait_credit": "Rudolf 1922", "portrait_license": "Public domain", "portrait_source": "Wikimedia Commons", "portrait_source_url": "https://commons.wikimedia.org/wiki/File:Sri_aurobindo.jpg", "portrait_url": "/bff/media/retreats/_gurus/aurobindo.jpg"},
    "bks-iyengar": {"portrait_credit": "Mutt Lunker", "portrait_license": "CC BY-SA 3.0", "portrait_license_url": "http://creativecommons.org/licenses/by-sa/3.0/", "portrait_source": "Wikimedia Commons", "portrait_source_url": "https://commons.wikimedia.org/wiki/File:BKS_Iyengar.jpg", "portrait_url": "/bff/media/retreats/_gurus/bks-iyengar.jpg"},
    "chinmayananda": {"portrait_credit": "Chmadeline", "portrait_license": "FAL", "portrait_license_url": "http://artlibre.org/licence/lal/en", "portrait_source": "Wikimedia Commons", "portrait_source_url": "https://commons.wikimedia.org/wiki/File:Sourire_coul_2.jpg", "portrait_url": "/bff/media/retreats/_gurus/chinmayananda.jpg"},
    "dayananda-saraswati": {"portrait_credit": "Mariusbutuc", "portrait_license": "CC BY-SA 4.0", "portrait_license_url": "https://creativecommons.org/licenses/by-sa/4.0", "portrait_source": "Wikimedia Commons", "portrait_source_url": "https://commons.wikimedia.org/wiki/File:HH_SDS.jpg", "portrait_url": "/bff/media/retreats/_gurus/dayananda-saraswati.jpg"},
    "desikachar": {"portrait_credit": "NarasinghP", "portrait_license": "CC0", "portrait_license_url": "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "portrait_source": "Wikimedia Commons", "portrait_source_url": "https://commons.wikimedia.org/wiki/File:T._K._V._Desikachar.jpg", "portrait_url": "/bff/media/retreats/_gurus/desikachar.jpg"},
    "goenka": {"portrait_license": "Wikimedia Commons", "portrait_source": "Wikimedia Commons", "portrait_source_url": "https://commons.wikimedia.org/wiki/File:The_Kalyanmitra_Satyanarayan_Goenka_who_brought_Vipassana_Meditation_technique_to_India_after_2500_years_is_seen_with_his_wife_while_speaking_at_a_talk_on_%22Values_in_Education_-_Good_Governance_through_Vipassana_Meditation%22_in.jpg", "portrait_url": "/bff/media/retreats/_gurus/goenka.jpg"},
    "kuvalayananda": {"portrait_credit": "Subodh Tiwari", "portrait_license": "CC BY-SA 3.0", "portrait_license_url": "https://creativecommons.org/licenses/by-sa/3.0", "portrait_source": "Wikimedia Commons", "portrait_source_url": "https://commons.wikimedia.org/wiki/File:Swami_Kuvalayananda.jpg", "portrait_url": "/bff/media/retreats/_gurus/kuvalayananda.jpg"},
    "lahiri-mahasaya": {"portrait_credit": "AnonymousUnknown author", "portrait_license": "Public domain", "portrait_source": "Wikimedia Commons", "portrait_source_url": "https://commons.wikimedia.org/wiki/File:Lahiri_Mahasaya.jpg", "portrait_url": "/bff/media/retreats/_gurus/lahiri-mahasaya.jpg"},
    "maharishi-mahesh": {"portrait_credit": "Vernon Barnes PhD Dr Jean Fortunet", "portrait_license": "CC BY-SA 3.0", "portrait_license_url": "https://creativecommons.org/licenses/by-sa/3.0", "portrait_source": "Wikimedia Commons", "portrait_source_url": "https://commons.wikimedia.org/wiki/File:Maharishi_Huntsville_Jan_1978A.JPG", "portrait_url": "/bff/media/retreats/_gurus/maharishi-mahesh.jpg"},
    "pattabhi-jois": {"portrait_credit": "Magnolia Zuniga", "portrait_license": "CC BY-SA 4.0", "portrait_license_url": "https://creativecommons.org/licenses/by-sa/4.0", "portrait_source": "Wikimedia Commons", "portrait_source_url": "https://commons.wikimedia.org/wiki/File:Guruji_white.jpg", "portrait_url": "/bff/media/retreats/_gurus/pattabhi-jois.jpg"},
    "ramakrishna": {"portrait_credit": "Abinash Chandra Dna", "portrait_license": "Public domain", "portrait_source": "Wikimedia Commons", "portrait_source_url": "https://commons.wikimedia.org/wiki/File:Ramakrishna.jpg", "portrait_url": "/bff/media/retreats/_gurus/ramakrishna.jpg"},
    "ramana": {"portrait_credit": "G. G. Welling", "portrait_license": "Public domain", "portrait_source": "Wikimedia Commons", "portrait_source_url": "https://commons.wikimedia.org/wiki/File:Sri_Ramana_Maharshi_-_Portrait_-_G._G_Welling_-_1948.jpg", "portrait_url": "/bff/media/retreats/_gurus/ramana.jpg"},
    "sadhguru": {"portrait_credit": "Isha Foundation", "portrait_license": "CC BY-SA 3.0", "portrait_license_url": "https://creativecommons.org/licenses/by-sa/3.0", "portrait_source": "Wikimedia Commons", "portrait_source_url": "https://commons.wikimedia.org/wiki/File:Sadhguru-Jaggi-Vasudev.jpg", "portrait_url": "/bff/media/retreats/_gurus/sadhguru.jpg"},
    "satchidananda": {"portrait_credit": "Alainfherve", "portrait_license": "CC BY-SA 4.0", "portrait_license_url": "https://creativecommons.org/licenses/by-sa/4.0", "portrait_source": "Wikimedia Commons", "portrait_source_url": "https://commons.wikimedia.org/wiki/File:Swami_Satchidananda_in_Yogaville_2.jpg", "portrait_url": "/bff/media/retreats/_gurus/satchidananda.jpg"},
    "sivananda": {"portrait_credit": "Nobody60", "portrait_license": "CC BY-SA 3.0", "portrait_license_url": "https://creativecommons.org/licenses/by-sa/3.0", "portrait_source": "Wikimedia Commons", "portrait_source_url": "https://commons.wikimedia.org/wiki/File:Swami_Shivananda_Liebe.jpg", "portrait_url": "/bff/media/retreats/_gurus/sivananda.jpg"},
    "sri-sri": {"portrait_credit": "Alex Marculescu", "portrait_license": "CC0", "portrait_license_url": "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "portrait_source": "Wikimedia Commons", "portrait_source_url": "https://commons.wikimedia.org/wiki/File:Sri_Sri_Ravi_Shankar_in_2026.jpg", "portrait_url": "/bff/media/retreats/_gurus/sri-sri.jpg"},
    "sri-yukteswar": {"portrait_credit": "Unknown authorUnknown author", "portrait_license": "Public domain", "portrait_source": "Wikimedia Commons", "portrait_source_url": "https://commons.wikimedia.org/wiki/File:Swami_Sri_Yukteswar_Pose.jpg", "portrait_url": "/bff/media/retreats/_gurus/sri-yukteswar.jpg"},
    "vishnudevananda": {"portrait_credit": "SivanandaEurope", "portrait_license": "CC BY-SA 4.0", "portrait_license_url": "https://creativecommons.org/licenses/by-sa/4.0", "portrait_source": "Wikimedia Commons", "portrait_source_url": "https://commons.wikimedia.org/wiki/File:Swami_Vishnudevananda_Portrait.jpg", "portrait_url": "/bff/media/retreats/_gurus/vishnudevananda.jpg"},
    "vivekananda": {"portrait_credit": "The original uploader was Dziewa at English Wikipedia.", "portrait_license": "Public domain", "portrait_source": "Wikimedia Commons", "portrait_source_url": "https://commons.wikimedia.org/wiki/File:Swami_Vivekananda-1893-09-signed.jpg", "portrait_url": "/bff/media/retreats/_gurus/vivekananda.jpg"},
    "yogananda": {"portrait_credit": "Unknown authorUnknown author", "portrait_license": "Public domain", "portrait_source": "Wikimedia Commons", "portrait_source_url": "https://commons.wikimedia.org/wiki/File:Paramahansa_Yogananda_Standard_Pose.jpg", "portrait_url": "/bff/media/retreats/_gurus/yogananda.jpg"},
    "yogi-bhajan": {"portrait_credit": "Kundalini Research Institute and Teachings of Yogi Bhajan (copyright holders)", "portrait_license": "CC BY-SA 4.0", "portrait_license_url": "https://creativecommons.org/licenses/by-sa/4.0", "portrait_source": "Wikimedia Commons", "portrait_source_url": "https://commons.wikimedia.org/wiki/File:Yogi_Bhajan_1985.jpg", "portrait_url": "/bff/media/retreats/_gurus/yogi-bhajan.jpg"},
}

# ────────────────────────────── SCRIPTURES ──────────────────────────────────
def SC(slug, cn, period, lang="Sanskrit", tradition=None, desc=None, alt=None,
       verification="Historically Documented", confidence="High", sources=None):
    return {"id": f"s-{slug}", "slug": slug, "canonical_name": cn, "alternate_names": alt or [],
            "period": period, "language": lang, "tradition": tradition, "description": desc,
            "verification_status": verification, "confidence_level": confidence,
            "source_ids": [f"src-{x}" for x in (sources or [])]}

SCRIPTURES = [
    SC("vedas", "The Vedas", "c. 1500–500 BCE", desc="The foundational śruti corpus of the Vedic tradition.", sources=["intro-hinduism"]),
    SC("principal-upanishads", "Principal Upaniṣads", "c. 800–200 BCE", desc="Philosophical culmination of the Vedas; seedbed of yogic and Vedāntic thought.", sources=["intro-hinduism"]),
    SC("yoga-upanishads", "Yoga Upaniṣads", "c. 1st millennium CE", desc="A group of later Upaniṣads devoted specifically to yoga.", confidence="Medium", sources=["roots-of-yoga"]),
    SC("bhagavad-gita", "Bhagavad Gītā", "c. 2nd c. BCE", desc="Presents the synthesis of karma, bhakti, jñāna and dhyāna yoga.", sources=["intro-hinduism"]),
    SC("yoga-sutras", "Yoga Sūtras of Patañjali", "c. 2nd–4th c. CE", tradition="Pātañjala Yoga", desc="Root text of classical (aṣṭāṅga) yoga.", sources=["yoga-sutras-bryant"]),
    SC("samkhya-karika", "Sāṃkhya Kārikā", "c. 4th c. CE", tradition="Sāṃkhya", desc="Classical exposition of Sāṃkhya metaphysics by Īśvarakṛṣṇa.", sources=["classical-samkhya"]),
    SC("brahma-sutras", "Brahma Sūtras", "c. 200 BCE–200 CE", tradition="Vedānta", desc="Aphoristic basis of all Vedānta schools.", sources=["intro-hinduism"]),
    SC("hatha-pradipika", "Haṭha Yoga Pradīpikā", "c. 15th c. CE", tradition="Haṭha Yoga", desc="Seminal haṭha manual by Svātmārāma.", sources=["hyp","roots-of-yoga"]),
    SC("gheranda-samhita-text", "Gheraṇḍa Saṃhitā", "c. 17th c. CE", tradition="Haṭha Yoga", desc="Encyclopaedic seven-limbed (saptāṅga) haṭha manual.", sources=["gheranda-samhita","roots-of-yoga"]),
    SC("shiva-samhita-text", "Śiva Saṃhitā", "c. 15th–17th c. CE", tradition="Haṭha / Tantra", desc="Tantric haṭha text framed as Śiva's teaching.", sources=["shiva-samhita","roots-of-yoga"]),
    SC("shiva-sutras", "Śiva Sūtras", "c. 9th c. CE", tradition="Kashmir Śaivism", desc="Revealed aphorisms foundational to Trika Śaivism.", sources=["doctrine-of-vibration"]),
    SC("spanda-karika", "Spanda Kārikā", "c. 9th c. CE", tradition="Spanda", desc="Verses on the vibratory nature of consciousness.", sources=["doctrine-of-vibration"]),
    SC("vijnana-bhairava", "Vijñāna Bhairava Tantra", "c. 8th–9th c. CE", tradition="Trika / Kashmir Śaivism", desc="112 dhāraṇās (meditation techniques).", sources=["saiva-age"]),
    SC("tantraloka-text", "Tantrāloka", "c. 1000 CE", tradition="Trika", desc="Abhinavagupta's magnum opus of tantric Śaivism.", sources=["tantraloka","saiva-age"]),
    SC("saundarya-lahari", "Saundarya Laharī", "attrib. Śaṅkara", tradition="Śrīvidyā", desc="Devotional-tantric hymn central to Śrīvidyā.", confidence="Medium", sources=["intro-hinduism"]),
    SC("lalita-sahasranama", "Lalitā Sahasranāma", "c. medieval", tradition="Śrīvidyā", desc="Thousand names of the Goddess Lalitā.", confidence="Medium"),
    SC("bhagavata-purana", "Bhāgavata Purāṇa", "c. 9th–10th c. CE", tradition="Vaiṣṇava", desc="Central devotional text of Kṛṣṇa-bhakti.", sources=["intro-hinduism"]),
    SC("narada-bhakti-sutra", "Nārada Bhakti Sūtra", "c. medieval", tradition="Bhakti", desc="Aphorisms defining the path of devotion.", confidence="Medium"),
    SC("yogadrishti-samuccaya", "Yogadṛṣṭisamuccaya", "c. 8th c. CE", tradition="Jain Yoga", desc="Haribhadra's comparative treatise on yoga.", confidence="Medium", sources=["encyclopedia-hinduism"]),
    SC("autobiography-of-a-yogi", "Autobiography of a Yogi", "1946", lang="English", tradition="Kriyā Yoga", desc="Yogananda's memoir; primary modern source.", verification="Verified", sources=["autobiography-yogi"]),
    SC("light-on-yoga-text", "Light on Yoga", "1966", lang="English", tradition="Iyengar Yoga", desc="Iyengar's foundational modern āsana manual.", verification="Verified", sources=["light-on-yoga"]),
]

# ─────────────────────────────── PRACTICES ──────────────────────────────────
def PR(slug, name, category, desc=None, verification="Historically Documented", confidence="High"):
    return {"id": f"pr-{slug}", "slug": slug, "name": name, "category": category,
            "description": desc, "verification_status": verification, "confidence_level": confidence}

PRACTICES = [
    PR("asana", "Āsana", "Posture", "Physical postures for stability and health."),
    PR("pranayama", "Prāṇāyāma", "Breath", "Regulation and extension of the breath / prāṇa."),
    PR("pratyahara", "Pratyāhāra", "Withdrawal", "Withdrawal of the senses."),
    PR("dharana", "Dhāraṇā", "Concentration", "One-pointed concentration."),
    PR("dhyana", "Dhyāna", "Meditation", "Sustained meditative absorption."),
    PR("samadhi", "Samādhi", "Absorption", "Unitive absorption, goal of Rāja Yoga."),
    PR("shatkarma", "Ṣaṭkarma", "Cleansing", "Six purificatory (kriyā) techniques of haṭha yoga."),
    PR("mudra", "Mudrā", "Seal", "Energetic seals/gestures."),
    PR("bandha", "Bandha", "Lock", "Energetic locks (mūla, uḍḍiyāna, jālandhara)."),
    PR("mantra-japa", "Mantra Japa", "Sound", "Repetition of sacred sound/mantra."),
    PR("nada", "Nāda meditation", "Sound", "Meditation on inner sound."),
    PR("trataka", "Trāṭaka", "Gaze", "Concentrated gazing practice."),
    PR("kirtan", "Kīrtan / Bhajan", "Devotion", "Devotional chanting."),
    PR("yoga-nidra", "Yoga Nidrā", "Relaxation", "Systematic guided relaxation (modernly systematised by Satyananda).", confidence="Medium"),
    PR("surya-namaskara", "Sūrya Namaskāra", "Sequence", "Sun-salutation sequence.", confidence="Medium"),
    PR("kundalini-awakening", "Kuṇḍalinī awakening", "Energy", "Awakening and raising of kuṇḍalinī energy."),
    PR("self-enquiry", "Ātma-vichāra", "Enquiry", "Self-enquiry ('Who am I?')."),
    PR("seva", "Sevā", "Service", "Selfless service as spiritual practice."),
]

# ────────────────────────────── METHODOLOGIES ───────────────────────────────
def M(slug, name, desc, origin, teacher_g=None, parampara=None, status="Modern", confidence="High"):
    return {"id": f"m-{slug}", "slug": slug, "name": name, "description": desc, "origin": origin,
            "associated_teacher_id": (f"g-{teacher_g}" if teacher_g else None),
            "associated_parampara_id": parampara, "historical_status": status,
            "confidence_level": confidence}

METHODOLOGIES = [
    M("iyengar-method", "Iyengar Method", "Precision alignment with extensive use of props and timed holds.", "Pune, 20th c.", teacher_g="bks-iyengar", parampara="iyengar-yoga"),
    M("ashtanga-vinyasa-method", "Ashtanga Vinyasa Method", "Fixed posture series linked by breath (tristana: breath, bandha, dṛṣṭi).", "Mysore, 20th c.", teacher_g="pattabhi-jois", parampara="ashtanga-vinyasa"),
    M("viniyoga-method", "Viniyoga (individualised)", "Practice adapted to the individual; breath-led vinyāsa-krama.", "Chennai, 20th c.", teacher_g="desikachar", parampara="viniyoga"),
    M("sivananda-five-points", "Sivananda Five Points", "Proper exercise, breathing, relaxation, diet, positive thinking & meditation.", "Rishikesh, 20th c.", teacher_g="vishnudevananda", parampara="sivananda-yoga"),
    M("satyananda-yoga-nidra", "Yoga Nidrā (Bihar system)", "Systematised guided yogic sleep / relaxation.", "Munger, 20th c.", teacher_g="satyananda", parampara="satyananda-yoga"),
    M("sudarshan-kriya", "Sudarshan Kriya", "Rhythmic cyclical breathing technique.", "Bengaluru, 1982", teacher_g="sri-sri", parampara="art-of-living"),
    M("inner-engineering", "Inner Engineering / Shambhavi Mahamudra", "Guided kriyā and meditation programme.", "Coimbatore, 20th–21st c.", teacher_g="sadhguru", parampara="isha-yoga"),
    M("tm-technique", "Transcendental Meditation", "Effortless silent mantra meditation, 20 min twice daily.", "20th c.", teacher_g="maharishi-mahesh", parampara="transcendental-meditation"),
    M("vipassana-goenka-method", "Vipassana (Goenka 10-day)", "Body-sensation-based insight meditation in the U Ba Khin tradition.", "20th c.", teacher_g="goenka", parampara="vipassana-goenka"),
    M("kundalini-3ho-method", "Kundalini Yoga (Yogi Bhajan)", "Kriyās, mantra and breath (incl. Breath of Fire).", "USA, 1969", teacher_g="yogi-bhajan", parampara="kundalini-yoga-3ho"),
]

# ────────────────────────────── INSTITUTIONS ────────────────────────────────
def I(slug, name, location, website=None, parampara=None, founded=None,
      verification="Verified", confidence="High"):
    return {"id": f"i-{slug}", "slug": slug, "name": name, "location": location, "website": website,
            "associated_parampara_id": parampara, "founded": founded,
            "verification_status": verification, "confidence_level": confidence}

INSTITUTIONS = [
    I("the-yoga-institute", "The Yoga Institute", "Santacruz, Mumbai", "theyogainstitute.org", parampara="the-yoga-institute-lineage", founded=1918),
    I("kaivalyadhama", "Kaivalyadhama", "Lonavla, Maharashtra", "kdham.com", parampara="kaivalyadhama-lineage", founded=1924),
    I("divine-life-society", "The Divine Life Society", "Rishikesh", "sivanandaonline.org", parampara="sivananda-yoga", founded=1936),
    I("bihar-school-of-yoga", "Bihar School of Yoga", "Munger, Bihar", "biharyoga.net", parampara="satyananda-yoga", founded=1964),
    I("sivananda-centres", "Sivananda Yoga Vedanta Centres", "Worldwide", "sivananda.org", parampara="sivananda-yoga", founded=1957),
    I("rimyi", "Ramamani Iyengar Memorial Yoga Institute", "Pune", "bksiyengar.com", parampara="iyengar-yoga", founded=1975),
    I("kym", "Krishnamacharya Yoga Mandiram", "Chennai", "kym.org", parampara="viniyoga", founded=1976),
    I("srf-yss", "Self-Realization Fellowship / Yogoda Satsanga Society", "Los Angeles / Ranchi", "yogananda.org", parampara="kriya-yoga-yogananda", founded=1920),
    I("ramakrishna-math", "Ramakrishna Math & Mission", "Belur Math, Kolkata", "belurmath.org", parampara="ramakrishna-vivekananda", founded=1897),
    I("aurobindo-ashram", "Sri Aurobindo Ashram", "Pondicherry", "sriaurobindoashram.org", parampara="sri-aurobindo-integral-yoga", founded=1926),
    I("isha-foundation", "Isha Foundation", "Coimbatore", "isha.sadhguru.org", parampara="isha-yoga", founded=1992),
    I("art-of-living-foundation", "Art of Living Foundation", "Bengaluru", "artofliving.org", parampara="art-of-living", founded=1981),
    I("chinmaya-mission", "Chinmaya Mission", "Mumbai", "chinmayamission.com", parampara="chinmaya-vedanta", founded=1953),
    I("arsha-vidya", "Arsha Vidya Gurukulam", "Coimbatore / Saylorsburg", "arshavidya.org", parampara="arsha-vidya", founded=1986),
    I("himalayan-institute", "Himalayan Institute", "Honesdale, USA", "himalayaninstitute.org", parampara="himalayan-yoga-tradition", founded=1971),
    I("kripalu-center", "Kripalu Center for Yoga & Health", "Stockbridge, USA", "kripalu.org", parampara="kripalu-yoga", founded=1974),
    I("ananda-marga-org", "Ananda Marga Pracaraka Samgha", "Kolkata / worldwide", "anandamarga.org", parampara="ananda-marga", founded=1955),
    I("brahma-kumaris-org", "Brahma Kumaris", "Mount Abu, Rajasthan", "brahmakumaris.org", parampara="brahma-kumaris", founded=1937),
    I("ramana-ashram", "Sri Ramanasramam", "Tiruvannamalai", "sriramanamaharshi.org", parampara="ramana-atma-vichara", founded=1922),
]

# ─────────────────────────────── PARAMPARAS ─────────────────────────────────
def P(slug, cn, dn, cls, origin, geo, hist="Traditional", verification="Historically Documented",
      confidence="Medium", parent=None, sampradaya=None, darshana=None, civ=None,
      desc=None, contemporary=None, evidence=None, sources=None):
    return {"id": slug, "slug": slug, "canonical_name": cn, "display_name": dn,
            "classification": cls, "origin_period": origin, "geographical_root": geo,
            "historical_status": hist, "verification_status": verification, "confidence_level": confidence,
            "parent_id": parent, "sampradaya_id": sampradaya, "darshana_id": darshana,
            "civilizational_root_id": civ, "description": desc, "contemporary_description": contemporary,
            "evidence_summary": evidence, "source_ids": [f"src-{x}" for x in (sources or [])]}

PARAMPARAS = [
    # ── Source traditions (civilizational roots) ──
    P("vedic-tradition", "Vedic Tradition", "Vedic Tradition", "Source Tradition", "c. 1500–500 BCE", "North-west & Gangetic India", desc="The Vedic sacrificial and contemplative matrix from which later Indian philosophy and yoga emerge.", sources=["intro-hinduism"]),
    P("upanishadic-tradition", "Aupaniṣada / Upaniṣadic Tradition", "Upaniṣadic Tradition", "Source Tradition", "c. 800–200 BCE", "Gangetic India", parent="vedic-tradition", desc="The Upaniṣads turn from ritual to inner knowledge (jñāna), introducing ātman–brahman and early meditative yoga.", sources=["intro-hinduism","roots-of-yoga"]),
    P("shramana-tradition", "Śramaṇa Tradition", "Śramaṇa Tradition", "Source Tradition", "c. 6th c. BCE onward", "Gangetic India", desc="The renunciant stream (parallel to the Vedic) feeding Jain, Buddhist and ascetic yoga.", sources=["roots-of-yoga"]),
    P("tantra-tradition", "Tantric Tradition", "Tantric Tradition", "Source Tradition", "c. 5th c. CE onward", "Pan-India", hist="Historical", desc="The Āgamic/Tantric revelation reshaping Śaiva, Śākta and later haṭha yoga.", sources=["saiva-age"]),

    # ── Darśanas (philosophical schools) ──
    P("samkhya-darshana", "Sāṃkhya Darśana", "Sāṃkhya", "Darśana", "c. 4th c. BCE–4th c. CE", "India", civ="vedic-tradition", desc="Dualist enumeration of puruṣa and prakṛti; metaphysical partner of Yoga.", sources=["classical-samkhya"]),
    P("yoga-darshana", "Pātañjala Yoga Darśana", "Pātañjala Yoga (Classical Yoga)", "Darśana", "c. 2nd–4th c. CE", "India (textual)", civ="vedic-tradition", desc="The eight-limbed (aṣṭāṅga) discipline codified in the Yoga Sūtras; citta-vṛtti-nirodha.", sources=["yoga-sutras-bryant"]),
    P("vedanta-darshana", "Vedānta Darśana", "Vedānta", "Darśana", "c. 200 BCE onward", "India", civ="upanishadic-tradition", desc="The school(s) interpreting the Upaniṣads, Brahma Sūtras and Gītā.", sources=["intro-hinduism"]),
    P("advaita-vedanta", "Advaita Vedānta", "Advaita Vedānta", "Darśana", "c. 8th c. CE", "India", parent="vedanta-darshana", desc="Non-dualist Vedānta expounded by Śaṅkara; brahman alone is real.", verification="Verified", confidence="High", sources=["intro-hinduism"]),
    P("vishishtadvaita", "Viśiṣṭādvaita", "Viśiṣṭādvaita Vedānta", "Darśana", "11th–12th c. CE", "Tamil Nadu", parent="vedanta-darshana", desc="Qualified non-dualism of Rāmānuja.", verification="Verified", confidence="High", sources=["intro-hinduism"]),
    P("dvaita-vedanta", "Dvaita Vedānta", "Dvaita Vedānta", "Darśana", "13th c. CE", "Karnataka", parent="vedanta-darshana", desc="Dualist Vedānta of Madhva.", verification="Verified", confidence="High", sources=["intro-hinduism"]),
    P("nyaya-darshana", "Nyāya Darśana", "Nyāya", "Darśana", "c. 2nd c. CE", "India", civ="vedic-tradition", desc="School of logic and epistemology.", sources=["intro-hinduism"]),
    P("vaisheshika-darshana", "Vaiśeṣika Darśana", "Vaiśeṣika", "Darśana", "c. 2nd c. BCE", "India", civ="vedic-tradition", desc="Atomistic natural philosophy.", sources=["intro-hinduism"]),
    P("mimamsa-darshana", "Pūrva Mīmāṃsā", "Mīmāṃsā", "Darśana", "c. 2nd c. BCE", "India", civ="vedic-tradition", desc="Exegetical school of Vedic ritual and dharma.", sources=["intro-hinduism"]),

    # ── Classical yoga paths (Historical Paramparā) ──
    P("jnana-yoga", "Jñāna Yoga", "Jñāna Yoga (Path of Knowledge)", "Historical Paramparā", "Upaniṣadic onward", "India", darshana="vedanta-darshana", civ="upanishadic-tradition", desc="The yoga of discriminative knowledge leading to liberating insight.", sources=["intro-hinduism"]),
    P("bhakti-yoga", "Bhakti Yoga", "Bhakti Yoga (Path of Devotion)", "Historical Paramparā", "c. Gītā onward", "India", civ="vedic-tradition", desc="The yoga of loving devotion to the divine.", sources=["intro-hinduism"]),
    P("karma-yoga", "Karma Yoga", "Karma Yoga (Path of Action)", "Historical Paramparā", "c. Gītā onward", "India", civ="vedic-tradition", desc="The yoga of selfless, non-attached action.", sources=["intro-hinduism"]),
    P("dhyana-yoga", "Dhyāna Yoga", "Dhyāna Yoga (Path of Meditation)", "Historical Paramparā", "Upaniṣadic onward", "India", darshana="yoga-darshana", desc="The yoga of sustained meditation.", sources=["roots-of-yoga"]),
    P("raja-yoga", "Rāja Yoga", "Rāja Yoga", "Historical Paramparā", "classical → popularised 19th c.", "India", darshana="yoga-darshana", desc="The 'royal' meditative yoga, identified with Patañjali's aṣṭāṅga; term popularised by Vivekananda.", sources=["yoga-sutras-bryant","yoga-tradition"]),
    P("mantra-yoga", "Mantra Yoga", "Mantra Yoga", "Historical Paramparā", "Vedic/Tantric", "India", desc="The yoga of sacred sound and japa.", sources=["yoga-tradition"]),
    P("laya-yoga", "Laya Yoga", "Laya Yoga", "Historical Paramparā", "medieval", "India", parent="tantra-tradition", desc="The yoga of dissolution of mind into subtle energy.", confidence="Low", verification="Requires Scholarly Verification", sources=["yoga-tradition"]),

    # ── Haṭha / Nātha / Siddha practice traditions ──
    P("hatha-yoga", "Haṭha Yoga", "Haṭha Yoga", "Yogic Practice Tradition", "c. 11th–15th c. CE", "India", parent="tantra-tradition", desc="The tradition of āsana, prāṇāyāma, mudrā and bandha preparing the body for meditation.", contemporary="The historical basis of most modern postural yoga.", verification="Verified", confidence="High", sources=["roots-of-yoga","hyp"]),
    P("natha-sampradaya", "Nātha Sampradāya", "Nātha Sampradāya", "Sampradāya", "c. 10th–12th c. CE", "Gorakhpur / Himalaya / Nepal", desc="The ascetic yogī order credited with systematising haṭha yoga.", verification="Historically Documented", confidence="Medium", sources=["alchemical-body","roots-of-yoga"]),
    P("gorakshanatha-tradition", "Gorakṣanātha Tradition", "Gorakṣanātha (Gorakhnath) Tradition", "Yogic Practice Tradition", "c. 11th–12th c. CE", "Gorakhpur", parent="natha-sampradaya", desc="The Nātha stream attributed to Gorakṣanātha.", confidence="Medium", sources=["alchemical-body"]),
    P("matsyendranatha-tradition", "Matsyendranātha Tradition", "Matsyendranātha Tradition", "Yogic Practice Tradition", "c. 10th c. CE", "Bengal / Nepal", parent="natha-sampradaya", desc="Stream attributed to the originary Nātha master; substantially legendary.", confidence="Low", verification="Requires Scholarly Verification", sources=["alchemical-body"]),
    P("hatha-pradipika-tradition", "Haṭha Pradīpikā Tradition", "Haṭha Yoga Pradīpikā Tradition", "Yogic Practice Tradition", "c. 15th c. CE", "India", parent="hatha-yoga", desc="The four-fold haṭha of Svātmārāma's Pradīpikā.", verification="Verified", confidence="High", sources=["hyp"]),
    P("gheranda-tradition", "Gheraṇḍa Tradition", "Gheraṇḍa Saṃhitā Tradition", "Yogic Practice Tradition", "c. 17th c. CE", "Bengal", parent="hatha-yoga", desc="The seven-limbed (saptāṅga) ghaṭastha yoga of the Gheraṇḍa Saṃhitā.", verification="Verified", confidence="High", sources=["gheranda-samhita"]),
    P("shiva-samhita-tradition", "Śiva Saṃhitā Tradition", "Śiva Saṃhitā Tradition", "Yogic Practice Tradition", "c. 15th–17th c. CE", "India", parent="hatha-yoga", desc="Tantric haṭha teaching framed as Śiva's instruction.", confidence="Medium", sources=["shiva-samhita"]),
    P("nada-yoga", "Nāda Yoga", "Nāda Yoga", "Yogic Practice Tradition", "medieval", "India", parent="hatha-yoga", desc="Meditation on inner sound (anāhata nāda).", confidence="Medium", sources=["yoga-tradition"]),
    P("svara-yoga", "Svara Yoga", "Svara Yoga", "Yogic Practice Tradition", "medieval", "India", parent="tantra-tradition", desc="The science of breath-rhythm and nāḍī.", confidence="Low", verification="Requires Scholarly Verification", sources=["yoga-tradition"]),
    P("kundalini-yoga-classical", "Kuṇḍalinī Yoga (classical)", "Kuṇḍalinī Yoga (Classical/Tantric)", "Yogic Practice Tradition", "c. 8th c. CE onward", "India", parent="tantra-tradition", desc="Classical tantric practice of awakening and raising kuṇḍalinī through the cakras.", confidence="Medium", sources=["saiva-age","yoga-tradition"]),
    P("kriya-yoga-classical", "Kriyā Yoga (classical/tantric)", "Kriyā Yoga (Classical)", "Yogic Practice Tradition", "medieval", "India", parent="tantra-tradition", desc="Tantric 'action' yoga of purificatory and energetic techniques (distinct from Yogananda's Kriyā).", confidence="Low", verification="Requires Scholarly Verification", sources=["yoga-tradition"]),
    P("tamil-siddha", "Tamil Siddha Tradition", "Tamil Siddhar Tradition", "Yogic Practice Tradition", "c. 6th–12th c. CE", "Tamil Nadu", desc="The Tamil Siddhars: yoga, medicine (siddha vaidya) and alchemy.", confidence="Medium", sources=["alchemical-body"]),
    P("rasayana-yoga", "Rasāyana / Alchemical Yoga", "Alchemical (Rasa) Yoga", "Yogic Practice Tradition", "medieval", "India", parent="tantra-tradition", desc="Mercurial/alchemical practices linked with Nātha-Siddha yoga.", confidence="Uncertain", verification="Requires Scholarly Verification", sources=["alchemical-body"]),

    # ── Śaiva ──
    P("shaiva-tradition", "Śaiva Tradition", "Śaiva Tradition", "Sampradāya", "c. 2nd c. BCE onward", "Pan-India", desc="The devotional and yogic worship of Śiva across many schools.", sources=["saiva-age"]),
    P("pashupata", "Pāśupata", "Pāśupata Śaivism", "Historical Paramparā", "c. 2nd c. CE", "Gujarat / North India", parent="shaiva-tradition", desc="One of the earliest organised Śaiva ascetic traditions.", confidence="Medium", sources=["saiva-age"]),
    P("kashmir-shaivism", "Kashmir Śaivism", "Kashmir Śaivism (Trika)", "Historical Paramparā", "c. 9th–11th c. CE", "Kashmir", parent="shaiva-tradition", desc="Non-dual tantric Śaivism synthesised by Abhinavagupta.", verification="Verified", confidence="High", sources=["saiva-age","tantraloka"]),
    P("trika-shaivism", "Trika", "Trika Śaivism", "Historical Paramparā", "c. 9th–11th c. CE", "Kashmir", parent="kashmir-shaivism", desc="The three-fold (Śiva–Śakti–nara) core of Kashmir Śaivism.", confidence="High", verification="Verified", sources=["tantraloka"]),
    P("spanda", "Spanda", "Spanda", "Historical Paramparā", "c. 9th c. CE", "Kashmir", parent="kashmir-shaivism", desc="The doctrine of the vibratory pulse of consciousness.", confidence="High", sources=["doctrine-of-vibration"]),
    P("pratyabhijna", "Pratyabhijñā", "Pratyabhijñā (Recognition)", "Historical Paramparā", "c. 10th c. CE", "Kashmir", parent="kashmir-shaivism", desc="The 'recognition' school of Utpaladeva and Abhinavagupta.", confidence="High", sources=["saiva-age"]),
    P("krama-shaivism", "Krama", "Krama", "Historical Paramparā", "c. 9th–10th c. CE", "Kashmir", parent="kashmir-shaivism", desc="Goddess-centred sequential (krama) worship.", confidence="Medium", sources=["saiva-age"]),
    P("kaula-tradition", "Kaula", "Kaula Tantra", "Historical Paramparā", "c. 9th c. CE", "Pan-India", parent="tantra-tradition", desc="Transgressive tantric ritual stream feeding both Śaiva and Śākta lines.", confidence="Medium", sources=["saiva-age"]),
    P("shaiva-siddhanta", "Śaiva Siddhānta", "Śaiva Siddhānta", "Sampradāya", "c. 6th–12th c. CE", "Tamil Nadu / Kashmir", parent="shaiva-tradition", desc="Dualist Āgamic Śaiva tradition, today centred in Tamil Nadu.", verification="Verified", confidence="High", sources=["saiva-age"]),
    P("virashaiva", "Vīraśaiva / Liṅgāyata", "Vīraśaiva (Liṅgāyata)", "Sampradāya", "12th c. CE", "Karnataka", parent="shaiva-tradition", desc="Devotional Śaiva reform movement of Basavaṇṇa.", verification="Verified", confidence="High", sources=["intro-hinduism"]),
    P("kapalika", "Kāpālika", "Kāpālika", "Historical Paramparā", "c. 5th–10th c. CE", "India", parent="shaiva-tradition", desc="Early transgressive Śaiva ascetics; little survives directly.", confidence="Uncertain", verification="Requires Scholarly Verification", sources=["saiva-age"]),

    # ── Śākta ──
    P("shakta-tradition", "Śākta Tradition", "Śākta Tradition", "Sampradāya", "c. 6th c. CE onward", "Pan-India (Bengal, Kashmir, South)", desc="Worship of the Goddess (Śakti) as ultimate reality.", sources=["saiva-age"]),
    P("shrividya", "Śrīvidyā", "Śrīvidyā", "Historical Paramparā", "c. 10th c. CE onward", "South India / Kashmir", parent="shakta-tradition", desc="Refined Śākta upāsana of the Śrī Yantra, mantra and Lalitā.", verification="Verified", confidence="High", sources=["intro-hinduism"]),
    P("kaula-shakta", "Kaula Śākta", "Kaula Śākta", "Historical Paramparā", "c. 9th c. CE", "Bengal / Kamarupa", parent="shakta-tradition", desc="Goddess-centred Kaula lineages.", confidence="Medium", sources=["saiva-age"]),
    P("kubjika", "Kubjikā Tradition", "Kubjikā (Paścimāmnāya)", "Historical Paramparā", "c. 11th c. CE", "Nepal", parent="shakta-tradition", desc="Western-transmission Śākta-Kaula tradition preserved in Nepal.", confidence="Uncertain", verification="Requires Scholarly Verification", sources=["saiva-age"]),

    # ── Vaiṣṇava ──
    P("vaishnava-tradition", "Vaiṣṇava Tradition", "Vaiṣṇava Tradition", "Sampradāya", "c. 2nd c. BCE onward", "Pan-India", desc="Devotion to Viṣṇu/Kṛṣṇa across the four classical sampradāyas.", sources=["intro-hinduism"]),
    P("pancharatra", "Pāñcarātra", "Pāñcarātra Āgama", "Historical Paramparā", "c. 3rd–8th c. CE", "India", parent="vaishnava-tradition", desc="Early Vaiṣṇava Āgamic ritual tradition.", confidence="Medium", sources=["intro-hinduism"]),
    P("vaikhanasa", "Vaikhānasa", "Vaikhānasa", "Historical Paramparā", "c. Vedic-derived", "South India", parent="vaishnava-tradition", desc="Ancient Vaiṣṇava temple-ritual tradition.", confidence="Medium", sources=["intro-hinduism"]),
    P("shri-vaishnava", "Śrī Vaiṣṇava", "Śrī Vaiṣṇava Sampradāya", "Sampradāya", "11th–12th c. CE", "Tamil Nadu", parent="vaishnava-tradition", darshana="vishishtadvaita", desc="The Rāmānuja sampradāya of Lakṣmī-Nārāyaṇa devotion.", verification="Verified", confidence="High", sources=["intro-hinduism"]),
    P("madhva-sampradaya", "Mādhva (Brahma) Sampradāya", "Mādhva Sampradāya", "Sampradāya", "13th c. CE", "Karnataka (Udupi)", parent="vaishnava-tradition", darshana="dvaita-vedanta", desc="The dualist Vaiṣṇava order of Madhva.", verification="Verified", confidence="High", sources=["intro-hinduism"]),
    P("gaudiya-vaishnava", "Gauḍīya Vaiṣṇava", "Gauḍīya Vaiṣṇava Sampradāya", "Sampradāya", "16th c. CE", "Bengal", parent="vaishnava-tradition", desc="Kṛṣṇa-bhakti tradition inspired by Caitanya Mahāprabhu.", verification="Verified", confidence="High", sources=["intro-hinduism"]),
    P("ramanandi-sampradaya", "Rāmānandī Sampradāya", "Rāmānandī Sampradāya", "Sampradāya", "14th–15th c. CE", "North India", parent="vaishnava-tradition", desc="Rāma-devotion ascetic order attributed to Rāmānanda.", confidence="Medium", sources=["intro-hinduism"]),
    P("nimbarka-sampradaya", "Nimbārka Sampradāya", "Nimbārka Sampradāya", "Sampradāya", "12th–13th c. CE", "Braj", parent="vaishnava-tradition", desc="Dvaitādvaita Vaiṣṇava order of Rādhā-Kṛṣṇa devotion.", confidence="Low", verification="Requires Scholarly Verification", sources=["intro-hinduism"]),
    P("pushtimarga", "Puṣṭimārga", "Puṣṭimārga (Vallabha)", "Sampradāya", "16th c. CE", "Braj / Gujarat", parent="vaishnava-tradition", desc="The 'path of grace' Kṛṣṇa-devotion of Vallabhācārya.", verification="Verified", confidence="High", sources=["intro-hinduism"]),
    P("varkari-sampradaya", "Vārkarī Sampradāya", "Vārkarī", "Sampradāya", "13th c. CE onward", "Maharashtra", parent="vaishnava-tradition", desc="Maharashtrian Viṭṭhala-devotion of the sant-poets.", verification="Verified", confidence="High", sources=["intro-hinduism"]),

    # ── Jain & Buddhist contemplative ──
    P("jain-yoga", "Jain Yoga", "Jain Yoga Tradition", "Related Contemplative Tradition", "c. 6th c. BCE onward", "India", parent="shramana-tradition", desc="Jain meditative and ethical yoga (dhyāna, kāyotsarga).", confidence="Medium", sources=["encyclopedia-hinduism"]),
    P("haribhadra-yoga", "Haribhadra's Yoga", "Haribhadra Yoga (Jain)", "Related Contemplative Tradition", "c. 8th c. CE", "India", parent="jain-yoga", desc="Haribhadrasūri's comparative Jain yoga (Yogadṛṣṭisamuccaya).", confidence="Medium", sources=["encyclopedia-hinduism"]),
    P("buddhist-contemplative-tradition", "Buddhist Contemplative Tradition", "Buddhist Contemplative Tradition", "Related Contemplative Tradition", "c. 5th c. BCE onward", "India → Asia", parent="shramana-tradition", desc="Buddhist meditative cultivation (śamatha–vipaśyanā, dhyāna).", sources=["roots-of-yoga"]),
    P("theravada", "Theravāda", "Theravāda", "Related Contemplative Tradition", "c. 3rd c. BCE", "Sri Lanka / SE Asia", parent="buddhist-contemplative-tradition", desc="The 'Way of the Elders'; source of modern vipassanā.", verification="Verified", confidence="High"),
    P("yogacara", "Yogācāra", "Yogācāra", "Darśana", "c. 4th c. CE", "India", parent="buddhist-contemplative-tradition", desc="'Yoga practice' Mahāyāna school of mind-only (cittamātra).", verification="Verified", confidence="High"),
    P("vajrayana", "Vajrayāna", "Vajrayāna", "Related Contemplative Tradition", "c. 7th c. CE", "India → Tibet", parent="buddhist-contemplative-tradition", desc="Tantric Buddhism of deity-yoga and subtle-body practice.", verification="Verified", confidence="High"),
    P("mahamudra", "Mahāmudrā", "Mahāmudrā", "Related Contemplative Tradition", "c. 8th–11th c. CE", "India → Tibet", parent="vajrayana", desc="The 'great seal' path to the nature of mind.", confidence="High"),
    P("dzogchen", "Dzogchen", "Dzogchen (Atiyoga)", "Related Contemplative Tradition", "c. 8th c. CE", "Tibet", parent="vajrayana", desc="The 'great perfection' teaching of primordial awareness.", confidence="High"),

    # ── Sant / other classical devotional ──
    P("sant-mat", "Sant Mat / Nirguṇa Bhakti", "Sant Mat (Nirguṇa Bhakti)", "Related Contemplative Tradition", "15th c. CE onward", "North India", desc="The formless-devotion path of Kabīr, Nānak and the sants.", confidence="Medium", sources=["intro-hinduism"]),
    P("dattatreya-tradition", "Dattātreya Tradition", "Dattātreya Tradition", "Sampradāya", "medieval", "Maharashtra / Deccan", desc="Avadhūta lineage venerating Dattātreya; links yoga, bhakti and jñāna.", confidence="Low", verification="Requires Scholarly Verification", sources=["yoga-tradition"]),
    P("avadhuta-tradition", "Avadhūta Tradition", "Avadhūta Tradition", "Related Contemplative Tradition", "medieval", "Pan-India", desc="Radically renunciant realised beings 'beyond convention'.", confidence="Low", verification="Requires Scholarly Verification"),

    # ── Modern teacher lineages ──
    P("kriya-yoga-yogananda", "Kriyā Yoga (Yogananda lineage)", "Kriyā Yoga (Yogananda)", "Modern Teacher Lineage", "19th–20th c.", "Varanasi → USA", hist="Modern", darshana="yoga-darshana", desc="Householder Kriyā revived by Lahiri Mahāśaya and brought worldwide by Yogananda.", contemporary="Stewarded by SRF/YSS.", verification="Verified", confidence="High", sources=["autobiography-yogi"]),
    P("krishnamacharya-lineage", "Krishnamacharya Lineage", "Krishnamacharya Lineage", "Modern Teacher Lineage", "20th c.", "Mysore / Chennai", hist="Modern", parent="hatha-yoga", desc="The fountainhead of modern postural yoga; teacher of Iyengar, Jois, Desikachar and Indra Devi.", verification="Verified", confidence="High", sources=["yoga-body"]),
    P("sivananda-yoga", "Sivananda Yoga", "Sivananda Yoga (Divine Life Society)", "Modern Teacher Lineage", "20th c.", "Rishikesh", hist="Modern", darshana="vedanta-darshana", desc="The synthesis of yoga and Vedānta taught by Swami Sivananda.", verification="Verified", confidence="High"),
    P("satyananda-yoga", "Satyananda Yoga", "Satyananda Yoga (Bihar School)", "Modern Teacher Lineage", "20th c.", "Munger, Bihar", hist="Modern", parent="sivananda-yoga", desc="Bihar School of Yoga; systematised tantra-informed yoga and Yoga Nidrā.", verification="Verified", confidence="High"),
    P("integral-yoga-satchidananda", "Integral Yoga (Satchidananda)", "Integral Yoga (Satchidananda)", "Modern Teacher Lineage", "20th c.", "India → USA", hist="Modern", parent="sivananda-yoga", desc="Holistic, interfaith Integral Yoga of Swami Satchidananda. Distinct from Sri Aurobindo's Integral Yoga.", verification="Verified", confidence="High"),
    P("himalayan-yoga-tradition", "Himalayan Yoga Tradition", "Himalayan Tradition (Swami Rama)", "Modern Teacher Lineage", "20th c.", "Himalaya → USA", hist="Modern", darshana="samkhya-darshana", desc="Meditation, yoga nidrā and prāṇāyāma of the Himalayan cave masters, taught by Swami Rama.", verification="Verified", confidence="High", sources=["living-himalayan-masters"]),
    P("ramakrishna-vivekananda", "Ramakrishna–Vivekananda", "Ramakrishna–Vivekananda (Rāja Yoga)", "Modern Teacher Lineage", "19th–20th c.", "Bengal", hist="Modern", darshana="advaita-vedanta", desc="Vivekananda's reframing of Rāja Yoga and the four yogas, rooted in Ramakrishna.", verification="Verified", confidence="High"),
    P("sri-aurobindo-integral-yoga", "Integral (Pūrṇa) Yoga — Sri Aurobindo", "Integral Yoga (Sri Aurobindo)", "Modern Teacher Lineage", "20th c.", "Pondicherry", hist="Modern", desc="The yoga of integral self-transformation of Sri Aurobindo and The Mother. Distinct from Satchidananda's Integral Yoga.", verification="Verified", confidence="High"),
    P("ramana-atma-vichara", "Ramana Maharshi — Ātma-vichāra", "Self-Enquiry (Ramana Maharshi)", "Modern Teacher Lineage", "20th c.", "Tiruvannamalai", hist="Modern", darshana="advaita-vedanta", desc="The direct path of self-enquiry taught by Ramana Maharshi.", verification="Verified", confidence="High"),
    P("arsha-vidya", "Arsha Vidya (Dayananda)", "Arsha Vidya (Dayananda Saraswati)", "Modern Teacher Lineage", "20th c.", "Coimbatore / Rishikesh", hist="Modern", darshana="advaita-vedanta", desc="Traditional Vedānta teaching (śravaṇa–manana–nididhyāsana) of Swami Dayananda Saraswati.", verification="Verified", confidence="High"),
    P("chinmaya-vedanta", "Chinmaya Vedānta", "Chinmaya Mission (Vedānta)", "Modern Teacher Lineage", "20th c.", "India → worldwide", hist="Modern", darshana="advaita-vedanta", desc="Systematic Vedānta study propagated by Swami Chinmayananda.", verification="Verified", confidence="High"),
    P("ag-mohan-lineage", "A. G. Mohan / Svastha", "A. G. Mohan Lineage (Svastha)", "Modern Teacher Lineage", "20th–21st c.", "Chennai", hist="Modern", parent="krishnamacharya-lineage", desc="Direct Krishnamacharya student; therapeutic, individualised yoga.", verification="Verified", confidence="High"),
    P("kripalu-yoga", "Kripalu Yoga", "Kripalu Yoga", "Modern Teacher Lineage", "20th c.", "India → USA", hist="Modern", desc="Prāṇa-led 'meditation in motion' of Swami Kripalvananda / Amrit Desai.", verification="Verified", confidence="Medium"),
    P("ananda-marga", "Ananda Marga", "Ananda Marga Yoga & Tantra", "Modern Teacher Lineage", "20th c.", "Bengal", hist="Modern", parent="tantra-tradition", desc="Tantric meditation (Sahaja Yoga), āsana and Neohumanist service of Ānandamūrti.", verification="Verified", confidence="High"),
    P("the-yoga-institute-lineage", "The Yoga Institute (Yogendra)", "The Yoga Institute (Yogendra Parampara)", "Modern Teacher Lineage", "1918", "Mumbai", hist="Modern", parent="hatha-yoga", desc="The world's oldest organised yoga centre; yoga for the householder.", verification="Verified", confidence="High"),
    P("kaivalyadhama-lineage", "Kaivalyadhama (Kuvalayananda)", "Kaivalyadhama Tradition", "Modern Teacher Lineage", "1924", "Lonavla", hist="Modern", parent="hatha-yoga", desc="Scientific study of yoga pioneered by Swami Kuvalayananda.", verification="Verified", confidence="High"),

    # ── Modern methodologies (branded methods) ──
    P("iyengar-yoga", "Iyengar Yoga", "Iyengar Yoga", "Modern Methodology", "20th c.", "Pune", hist="Modern", parent="krishnamacharya-lineage", desc="Alignment- and prop-based method of B. K. S. Iyengar.", contemporary="A globally taught modern method — NOT an ancient paramparā.", verification="Verified", confidence="High", sources=["light-on-yoga","yoga-body"]),
    P("ashtanga-vinyasa", "Ashtanga Vinyasa Yoga", "Ashtanga Vinyasa Yoga", "Modern Methodology", "20th c.", "Mysore", hist="Modern", parent="krishnamacharya-lineage", desc="Breath-linked fixed-series method of K. Pattabhi Jois. Not to be confused with Patañjali's aṣṭāṅga.", verification="Verified", confidence="High", sources=["yoga-mala","yoga-body"]),
    P("viniyoga", "Viniyoga", "Viniyoga (Desikachar)", "Modern Methodology", "20th c.", "Chennai", hist="Modern", parent="krishnamacharya-lineage", desc="Individualised, breath-led method of T. K. V. Desikachar.", verification="Verified", confidence="High", sources=["heart-of-yoga"]),
    P("isha-yoga", "Isha Yoga", "Isha Yoga (Classical Haṭha)", "Modern Methodology", "20th–21st c.", "Coimbatore", hist="Modern", parent="hatha-yoga", desc="Classical haṭha and inner-engineering practices of the Isha Foundation.", verification="Verified", confidence="High"),
    P("art-of-living", "Art of Living", "Art of Living (Sudarshan Kriya)", "Modern Methodology", "1981", "Bengaluru", hist="Modern", desc="Breath-based wellbeing centred on the Sudarshan Kriya.", verification="Verified", confidence="High"),
    P("kundalini-yoga-3ho", "Kundalini Yoga (Yogi Bhajan / 3HO)", "Kundalini Yoga (Yogi Bhajan)", "Modern Methodology", "1969", "Punjab → USA", hist="Modern", parent="kundalini-yoga-classical", desc="Kriyā-and-mantra method taught by Yogi Bhajan. A modern method, distinct from classical kuṇḍalinī tantra.", verification="Verified", confidence="Medium"),
    P("transcendental-meditation", "Transcendental Meditation", "Transcendental Meditation (Maharishi)", "Modern Methodology", "1955", "India → worldwide", hist="Modern", parent="mantra-yoga", desc="Silent mantra-meditation technique of Maharishi Mahesh Yogi.", verification="Verified", confidence="High"),
    P("vipassana-goenka", "Vipassana (Goenka)", "Vipassana (S. N. Goenka)", "Modern Methodology", "20th c.", "Myanmar → India", hist="Modern", parent="theravada", desc="Modern lay presentation of Theravāda vipassanā by S. N. Goenka.", verification="Verified", confidence="High"),

    # ── Modern institutions with a distinct doctrine ──
    P("brahma-kumaris", "Brahma Kumaris (Rāja Yoga meditation)", "Brahma Kumaris", "Modern Institution", "1937", "Mount Abu, Rajasthan", hist="Modern", desc="A modern spiritual movement whose 'Raja Yoga' meditation is doctrinally distinct from Patañjala Rāja Yoga.", contemporary="Uses the term 'Raja Yoga' for its own meditation, NOT Patañjali's system.", verification="Verified", confidence="High"),
    P("gayatri-pariwar", "Gayatri Pariwar (Dev Sanskriti)", "Gayatri Pariwar", "Modern Institution", "20th c.", "Shantikunj, Haridwar", hist="Modern", parent="vedic-tradition", desc="Vedic-revival movement of Gāyatrī sādhana and yajña.", verification="Verified", confidence="Medium"),
]

# ─────────────────────── RELATIONSHIP EDGES (FK) ────────────────────────────
# Guru → teacher-guru (i.e. `guru_id` learned from `teacher_guru_id`). Only
# well-documented links; traditional/mythic ones carry Low/Uncertain confidence.
def GL(disciple, teacher, rel="guru-disciple", period=None, conf="High",
       verification="Historically Documented", src=None, note=None):
    return {"id": f"gl-{disciple}-{teacher}", "guru_id": f"g-{disciple}", "teacher_guru_id": f"g-{teacher}",
            "relationship_type": rel, "period": period, "evidence_source_id": (f"src-{src}" if src else None),
            "confidence_level": conf, "verification_status": verification, "note": note}

GURU_LINEAGE = [
    GL("gorakshanath", "matsyendranath", rel="traditional-attribution", conf="Low", verification="Requires Scholarly Verification", src="alchemical-body", note="Traditional attribution; historicity debated."),
    GL("vivekananda", "ramakrishna", period="c. 1881–1886", src="intro-hinduism"),
    GL("sri-yukteswar", "lahiri-mahasaya", src="autobiography-yogi"),
    GL("yogananda", "sri-yukteswar", src="autobiography-yogi"),
    GL("bks-iyengar", "krishnamacharya", period="1930s", src="yoga-body"),
    GL("pattabhi-jois", "krishnamacharya", period="1927–1945", src="yoga-body"),
    GL("desikachar", "krishnamacharya", period="1960s–1980s", src="heart-of-yoga"),
    GL("ag-mohan", "krishnamacharya", period="1971–1989"),
    GL("satyananda", "sivananda", period="1943–1956"),
    GL("vishnudevananda", "sivananda", period="1940s"),
    GL("satchidananda", "sivananda", period="1940s"),
    GL("chinmayananda", "sivananda", rel="initiated-by", period="1949"),
    GL("chinmayananda", "tapovan", rel="principal-teacher", period="1949–1957"),
    GL("dayananda-saraswati", "chinmayananda", period="1960s", conf="Medium"),
    # ── Added disciple links (well-documented) for lineage-timeline coverage ──
    GL("geeta-iyengar", "bks-iyengar", period="1950s–2014", src="yoga-body"),
    GL("prashant-iyengar", "bks-iyengar", period="1960s–2014"),
    GL("sharath-jois", "pattabhi-jois", period="1990–2009", src="yoga-body"),
    GL("manju-jois", "pattabhi-jois", period="1950s–2009"),
    GL("indra-devi", "krishnamacharya", period="1937–1939", src="yoga-body"),
    GL("niranjanananda", "satyananda", period="1971–2009"),
    GL("rajarshi-janakananda", "yogananda", period="1932–1952", src="autobiography-yogi"),
    GL("daya-mata", "yogananda", period="1931–1952", src="autobiography-yogi"),
    GL("rajmani-tigunait", "swami-rama", period="1976–1996", src="living-himalayan-masters"),
    GL("brahmananda", "ramakrishna", period="c. 1881–1886"),
    GL("padmapada", "adi-shankara", rel="traditional-attribution", conf="Low", verification="Requires Scholarly Verification", src="intro-hinduism", note="Traditional attribution; the four-disciple account is hagiographic."),
    GL("sureshvara", "adi-shankara", rel="traditional-attribution", conf="Low", verification="Requires Scholarly Verification", src="intro-hinduism", note="Traditional attribution; historicity/dating debated."),
    GL("hastamalaka", "adi-shankara", rel="traditional-attribution", conf="Low", verification="Requires Scholarly Verification", src="intro-hinduism", note="Traditional attribution."),
    GL("totakacharya", "adi-shankara", rel="traditional-attribution", conf="Low", verification="Requires Scholarly Verification", src="intro-hinduism", note="Traditional attribution."),
]

# Parampara ↔ principal / associated Guru.
def PG(parampara, guru, role="principal", conf="High", verification="Historically Documented"):
    return {"id": f"pg-{parampara}-{guru}", "parampara_id": parampara, "guru_id": f"g-{guru}",
            "role": role, "confidence_level": conf, "verification_status": verification}

PARAMPARA_GURU = [
    PG("yoga-darshana", "patanjali", conf="Medium", verification="Requires Scholarly Verification"),
    PG("yoga-darshana", "vyasa-bhashyakara", role="commentator", conf="Medium"),
    PG("advaita-vedanta", "adi-shankara"),
    PG("vishishtadvaita", "ramanuja"),
    PG("shri-vaishnava", "ramanuja"),
    PG("dvaita-vedanta", "madhva"),
    PG("madhva-sampradaya", "madhva"),
    PG("natha-sampradaya", "gorakshanath", conf="Medium"),
    PG("natha-sampradaya", "matsyendranath", role="associated", conf="Low", verification="Requires Scholarly Verification"),
    PG("gorakshanatha-tradition", "gorakshanath", conf="Medium"),
    PG("hatha-pradipika-tradition", "svatmarama"),
    PG("kashmir-shaivism", "abhinavagupta"),
    PG("trika-shaivism", "abhinavagupta"),
    PG("spanda", "vasugupta", conf="Medium"),
    PG("virashaiva", "basavanna"),
    PG("pushtimarga", "vallabha"),
    PG("nimbarka-sampradaya", "nimbarka", conf="Low", verification="Requires Scholarly Verification"),
    PG("gaudiya-vaishnava", "chaitanya"),
    PG("ramanandi-sampradaya", "ramananda", conf="Low", verification="Requires Scholarly Verification"),
    PG("haribhadra-yoga", "haribhadra", conf="Medium"),
    PG("kriya-yoga-yogananda", "lahiri-mahasaya"),
    PG("kriya-yoga-yogananda", "yogananda", role="associated"),
    PG("krishnamacharya-lineage", "krishnamacharya"),
    PG("iyengar-yoga", "bks-iyengar"),
    PG("ashtanga-vinyasa", "pattabhi-jois"),
    PG("viniyoga", "desikachar"),
    PG("ag-mohan-lineage", "ag-mohan"),
    PG("sivananda-yoga", "sivananda"),
    PG("satyananda-yoga", "satyananda"),
    PG("integral-yoga-satchidananda", "satchidananda"),
    PG("himalayan-yoga-tradition", "swami-rama"),
    PG("ramakrishna-vivekananda", "vivekananda"),
    PG("ramakrishna-vivekananda", "ramakrishna", role="root"),
    PG("sri-aurobindo-integral-yoga", "aurobindo"),
    PG("ramana-atma-vichara", "ramana"),
    PG("chinmaya-vedanta", "chinmayananda"),
    PG("arsha-vidya", "dayananda-saraswati"),
    PG("kripalu-yoga", "kripalvananda"),
    PG("ananda-marga", "anandamurti"),
    PG("the-yoga-institute-lineage", "yogendra"),
    PG("kaivalyadhama-lineage", "kuvalayananda"),
    PG("isha-yoga", "sadhguru"),
    PG("art-of-living", "sri-sri"),
    PG("kundalini-yoga-3ho", "yogi-bhajan"),
    PG("transcendental-meditation", "maharishi-mahesh"),
    PG("vipassana-goenka", "goenka"),
]

def PS(parampara, scripture):
    return {"id": f"ps-{parampara}-{scripture}", "parampara_id": parampara, "scripture_id": f"s-{scripture}"}

PARAMPARA_SCRIPTURE = [
    PS("vedic-tradition", "vedas"), PS("upanishadic-tradition", "principal-upanishads"),
    PS("yoga-darshana", "yoga-sutras"), PS("samkhya-darshana", "samkhya-karika"),
    PS("vedanta-darshana", "brahma-sutras"), PS("advaita-vedanta", "principal-upanishads"),
    PS("advaita-vedanta", "bhagavad-gita"), PS("jnana-yoga", "bhagavad-gita"),
    PS("bhakti-yoga", "bhagavad-gita"), PS("bhakti-yoga", "narada-bhakti-sutra"),
    PS("karma-yoga", "bhagavad-gita"), PS("raja-yoga", "yoga-sutras"),
    PS("hatha-yoga", "hatha-pradipika"), PS("hatha-pradipika-tradition", "hatha-pradipika"),
    PS("gheranda-tradition", "gheranda-samhita-text"), PS("shiva-samhita-tradition", "shiva-samhita-text"),
    PS("kashmir-shaivism", "shiva-sutras"), PS("kashmir-shaivism", "tantraloka-text"),
    PS("spanda", "spanda-karika"), PS("trika-shaivism", "vijnana-bhairava"),
    PS("shrividya", "saundarya-lahari"), PS("shrividya", "lalita-sahasranama"),
    PS("gaudiya-vaishnava", "bhagavata-purana"), PS("pushtimarga", "bhagavata-purana"),
    PS("haribhadra-yoga", "yogadrishti-samuccaya"), PS("kriya-yoga-yogananda", "autobiography-of-a-yogi"),
    PS("iyengar-yoga", "light-on-yoga-text"),
]

def PP(parampara, practice):
    return {"id": f"pp-{parampara}-{practice}", "parampara_id": parampara, "practice_id": f"pr-{practice}"}

PARAMPARA_PRACTICE = [
    PP("yoga-darshana", "dharana"), PP("yoga-darshana", "dhyana"), PP("yoga-darshana", "samadhi"),
    PP("yoga-darshana", "pratyahara"), PP("raja-yoga", "dhyana"), PP("raja-yoga", "samadhi"),
    PP("hatha-yoga", "asana"), PP("hatha-yoga", "pranayama"), PP("hatha-yoga", "mudra"),
    PP("hatha-yoga", "bandha"), PP("hatha-yoga", "shatkarma"),
    PP("hatha-pradipika-tradition", "asana"), PP("hatha-pradipika-tradition", "pranayama"),
    PP("gheranda-tradition", "shatkarma"), PP("gheranda-tradition", "mudra"),
    PP("nada-yoga", "nada"), PP("mantra-yoga", "mantra-japa"),
    PP("bhakti-yoga", "kirtan"), PP("karma-yoga", "seva"),
    PP("jnana-yoga", "self-enquiry"), PP("ramana-atma-vichara", "self-enquiry"),
    PP("kundalini-yoga-classical", "kundalini-awakening"),
    PP("satyananda-yoga", "yoga-nidra"), PP("himalayan-yoga-tradition", "yoga-nidra"),
    PP("iyengar-yoga", "asana"), PP("ashtanga-vinyasa", "asana"), PP("ashtanga-vinyasa", "surya-namaskara"),
    PP("transcendental-meditation", "mantra-japa"), PP("art-of-living", "pranayama"),
]

def PM(parampara, methodology):
    return {"id": f"pm-{parampara}-{methodology}", "parampara_id": parampara, "methodology_id": f"m-{methodology}"}

PARAMPARA_METHODOLOGY = [
    PM("iyengar-yoga", "iyengar-method"), PM("ashtanga-vinyasa", "ashtanga-vinyasa-method"),
    PM("viniyoga", "viniyoga-method"), PM("sivananda-yoga", "sivananda-five-points"),
    PM("satyananda-yoga", "satyananda-yoga-nidra"), PM("art-of-living", "sudarshan-kriya"),
    PM("isha-yoga", "inner-engineering"), PM("transcendental-meditation", "tm-technique"),
    PM("vipassana-goenka", "vipassana-goenka-method"), PM("kundalini-yoga-3ho", "kundalini-3ho-method"),
]

# ── Example teacher affiliations (DECLARED / UNVERIFIED only — never auto-verified) ──
# teacher_id here is the public teacher handle (soft reference to the remote system).
def TP(teacher_id, parampara, rel="Teacher-declared", guru=None, inst=None, years=None,
       cert=None, verification="Unverified", city=None):
    return {"id": f"tp-{teacher_id}-{parampara}", "teacher_id": teacher_id, "parampara_id": parampara,
            "relationship_type": rel, "guru_id": (f"g-{guru}" if guru else None),
            "guru_name": None, "guru_guru_name": None, "city_id": city,
            "training_institution": inst, "years_of_training": years, "certification": cert,
            "practices_taught": [], "practices_learned": [], "scriptures_studied": [],
            "evidence_document": None, "verification_status": verification,
            "review_state": "pending_review", "verified_by": None, "verified_at": None}

# Example rows removed: real inventory now comes from the directory bridge
# (knowledge_bridge.py). Keeping these empty avoids unique-key collisions with
# bridge-derived city/teacher edges during re-seeds.
TEACHER_PARAMPARA: list = []

CITY_PARAMPARA: list = []

# ── Example city ↔ parampara availability (derived counts; illustrative) ──
def CP(city_id, parampara, count, status="available"):
    return {"id": f"cp-{city_id}-{parampara}", "city_id": city_id, "parampara_id": parampara,
            "teacher_count": count, "availability_status": status}


# ── SEED_SMALL: ~10 curated paramparas that exercise EVERY classification ──
SEED_SMALL_SLUGS = [
    "vedic-tradition",         # Source Tradition
    "yoga-darshana",           # Darśana
    "natha-sampradaya",        # Sampradāya
    "hatha-yoga",              # Yogic Practice Tradition
    "raja-yoga",               # Historical Paramparā
    "krishnamacharya-lineage", # Modern Teacher Lineage
    "iyengar-yoga",            # Modern Methodology
    "brahma-kumaris",          # Modern Institution
    "vipassana-goenka",        # (Modern Methodology, Buddhist-derived)
    "buddhist-contemplative-tradition",  # Related Contemplative Tradition
]

SCHEMA_VERSION = 1

