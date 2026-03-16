# 🌊 HÜRMÜZ BOĞAZI v5.0 — Final Dokümantasyon

> Son güncelleme: 16 Mart 2026 — 2336 satır, tüm buglar düzeltildi

---

## 📊 PROJE DURUMU

| Metrik | Değer |
|---|---|
| Toplam Satır | 2336 |
| Dosya Sayısı | 6 (tek JSX + proje dosyaları) |
| Engine | Three.js r128 + React 18 + Tone.js + Vite 5 |
| Birim Tipi | 10 (drone, mine, missile, patrol, submarine, destroyer, minesweeper, interceptor, convoy, f35) |
| Başarım | 10 farklı achievement |
| Hava Durumu | 3 tip (açık, fırtına, sis) |
| Diplomasi Olayı | 8 farklı |
| Tutorial Adımı | 7 |

---

## 🎮 TÜM ÖZELLİKLER

### Temel Mekanikler
- Turn-based strateji, 12×8 grid, 15 tur
- İran vs Koalisyon, her iki taraf oynanabilir
- Birlik satın al → yerleştir → hareket → saldır → tur bitir
- Dinamik petrol ekonomisi ($40-$200/bbl)
- Konvoy geçiş sistemi (tankerler otomatik ilerler)

### 3D Dünya
- Three.js ile tamamen 3D render
- İran: Yeşil dağlar, kar başlıklı tepeler, kıyı kumsal
- Umman: Çöl, kum tepeleri, kahverengi kayalıklar
- Cam platform oyun kareleri (glassmorphism)
- 4 petrol platformu (derrick, vinç, helipad, flare stack)
- Kıyı köpüğü animasyonları
- Akıntı parçacıkları
- Boğaz tehlike glow'u
- Derinlik renk katmanları
- Liman yapıları (Bandar Abbas, Muscat, Fujairah)
- Navigasyon şamandıraları (kırmızı/yeşil ışıklı)
- Deniz yolu çizgileri
- "HÜRMÜZ BOĞAZI" yüzen etiket
- Gradient skybox
- ACES tonemapping

### Birimler (10 tip)
- Her biri elle oluşturulmuş 3D composite model
- Destroyer: Taretler, radar, köprü, kırmızı su hattı
- Convoy: 3 petrol tankı, baca, köprü
- Submarine: Palet gövde, kule, periskop, baloncuk efekti
- F-35: Delta kanat, twin jet glow, contrail izi
- Drone: Kanat, motor alevi, dönerek uçar
- Mayın: Dikenli küre, zincir, tehlike ışığı
- Her birimde: HP barı, faction dot, gölge, bob animasyonu

### Savaş Sistemi
- Sinematik kamera: Saldırıda otomatik zoom → mermi uçuşu → patlama → geri dönüş
- AI saldırıları da sinematik: Sırayla 800ms aralarla, her biri kamera zoom + mermi + patlama
- Renkli mermiler: Drone=turuncu, Füze=kırmızı, F-35=mavi
- Mermi altında PointLight izi
- 3 aşamalı patlama flaşı
- 45 parçacıklı patlama efekti
- Gemi batış animasyonu (yavaş gömülme + duman + baloncuk)
- Wake trail (gemi iz halkaları)

### Düşman Ayırt Etme
- Düşman HP barları kırmızı arka plan + kırmızı gradient + ☠ kafatası
- Dost HP barları yeşil/sarı gradient + faction renk şerit
- Düşman birimlerin altında kırmızı PointLight + nabız atan kırmızı halka

### Akıllı AI
- Stratejik birim seçimi (weighted): Duruma göre ağırlık değişir
- Stratejik yerleştirme: Boğaz öncelikli, düşmana yakın, konvoy avı/koruması
- Öncelikli hedefleme: Konvoy > düşük HP > pahalı birim
- Aktif hareket: Boğaza doğru, düşman menzilinde pozisyon alma
- Hava koşullarına uyum: Fırtınada hava birimleri kullanmaz, siste denizaltı tercih eder

### Hava Sistemi
- Açık (☀️): Normal
- Fırtına (⛈️): Hız ½, hasar %70, menzil %80, drone/füze/F-35 uçamaz
- Sis (🌫️): Menzil ½, hasar %80, denizaltı avantajlı
- Three.js fog yoğunluğu gerçek zamanlı değişir

### Diplomasi
- %20 olasılıkla her tur: Çin, Rusya, AB, BM, İngiltere, Hindistan, S.Arabistan
- Efektler: Ateşkes, bütçe boost, gelir nerf, HP iyileşme, petrol sabitlme/spike
- Mor banner ile gösterilir

### Gece Modu
- Toggle buton (☀️/🌙)
- Şehir ışıkları (İran + Umman kıyıları)
- 2 dönen deniz feneri
- Yıldızlar
- Dramatik ışık değişimi

### Ses Sistemi (Tone.js)
- Patlama, su sıçrama, mayın, UI tıklama, haber alarmı, tur sonu
- Okyanus ambiyansı (LFO modülasyonlu brown noise)
- Oyun bitince otomatik durur

### Tutorial (7 adım)
- Ekranın altında, oyunu engellemeyen panel
- Hoşgeldin → Birlik Al → Yerleştir → Hareket → Saldır → Tur Bitir → Başla
- Her adımda "Devam →" butonu + "Atla" + ✕ kapatma
- Aksiyon yapılınca da otomatik ilerler

### Terfi Sistemi
- 3 kill = otomatik terfi
- +10 max HP, tam iyileşme, %25 hasar bonusu
- 3D'de altın yıldız (pulse animasyonlu + PointLight)
- Seçim panelinde kill sayısı + terfi badge

### Başarım Sistemi (10 başarım)
- İlk Kan, Konvoy Avcısı, Mayıncı, Petrol Baronu, Ekonomist, Konvoy Ustası, As Pilot, Hayatta Kalan, Boğaz Hâkimi, Kriz Yöneticisi
- Mor popup ile bildirim
- Sol altta ikon listesi
- Game Over'da tam liste

### Tur Özet Ekranı
- Her tur sonunda: Petrol değişimi, konvoy, kayıp, düşman imha
- Hava + birim dengesi bilgisi
- Manuel kapatma (Devam Et butonu)

### Game Over Ekranı
- 6'lı istatistik grid (petrol, konvoy, imha, kill, harcama, başarım)
- Kazanılan başarımlar listesi
- Skor karşılaştırma

### Hızlı Satın Alma
- 3D altında her zaman görünen toolbar
- Tek tıkla birim seç
- Klavye kısayolları: 1-5 birim, ESC iptal, R tekrar
- İptal (❌) ve Tekrar (🔄) butonları
- Yerleştirme bilgi overlay'i

---

## 🔧 BİLİNEN SORUNLAR (v5'te düzeltildi)

| # | Sorun | Durum |
|---|---|---|
| 1 | useMemo import ama kullanılmıyor | ✅ Düzeltildi |
| 2 | startSinking dead code | ✅ Kaldırıldı |
| 3 | Game Over'da ambiyans durmuyor | ✅ Düzeltildi |
| 4 | AI bütçesi çok düşük | ✅ Düzeltildi |
| 5 | Quick-buy stat tracking eksik | ✅ buyUnit() kullanıyor |
| 6 | Klavye kısayolları stat takibi yok | ✅ Eklendi |
| 7 | Tur özeti otomatik kapanıyor | ✅ Manuel kapanma |
| 8 | SYNC dep array'de promotions eksik | ✅ Eklendi |

---

## 🚀 KALAN GELİŞTİRME ALANLARI

- 📱 Mobil touch kontroller
- 🎵 Epik savaş müziği (sentez orkestra)
- 🗺️ İkinci harita (Kızıldeniz / Süveyş)
- 🌫️ Fog of War (keşif sistemi)
- 💾 Kayıt/yükleme
- 🏗️ Daha detaylı şehir yapıları
- ⚡ Performans optimizasyonu (instanced rendering)

---

*Engine: Three.js r128 + React 18 + Tone.js 14 + Vite 5*
