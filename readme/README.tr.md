<!-- baton-src: README.md sha256:71680646d0ac status:stale -->
# 🥁 Baton — Projeyi devret, bağlamını değil.

<p align="center">
  <img src="../gittop.png" alt="Baton — Pass your project, not your context" width="100%">
</p>

<h2 align="center">Bilgisayarı değiştir, yapay zekâyı değiştir, oturumu değiştir — tek cümleyle çalışmaya devam et.</h2>

<p align="center">
  <a href="https://github.com/kakadeka/Baton"><img src="https://img.shields.io/github/stars/kakadeka/Baton?style=social" alt="GitHub stars"></a>
  <a href="https://www.npmjs.com/package/@kakadeka/dsh-baton"><img src="https://img.shields.io/npm/v/@kakadeka/dsh-baton?logo=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@kakadeka/dsh-baton"><img src="https://img.shields.io/npm/dm/@kakadeka/dsh-baton" alt="npm downloads"></a>
  <a href="https://github.com/kakadeka/Baton/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="license"></a>
  <a href="https://bundlephobia.com/package/@kakadeka/dsh-baton"><img src="https://img.shields.io/bundlephobia/minzip/@kakadeka/dsh-baton" alt="bundle size"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D18-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/git-required-F05032?logo=git&logoColor=white" alt="git required">
  <img src="https://img.shields.io/badge/pwsh-5.1%2B-5391FE?logo=powershell&logoColor=white" alt="pwsh">
  <img src="https://img.shields.io/badge/DSH-plugin-4D6BFE?logo=deepseek&logoColor=white" alt="DSH plugin">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="platform">
</p>

<p align="center">
  <a href="../README.md">English</a> ·
  <a href="README.zh.md">简体中文</a> ·
  <a href="README.zh-TW.md">繁體中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt.md">Português</a> ·
  <a href="README.ru.md">Русский</a> ·
  Türkçe ·
  <a href="README.ar.md">العربية</a> ·
  <a href="README.th.md">ไทย</a>
</p>

**Baton, proje bayrak yarışı iş birliği sistemidir.** Claude Code, Codex, Cursor ve DeepSeek Harness'in makineler arasında sırayla **aynı projeyi** sürdürmesini sağlar — ilerleme, hafıza, tasarım şartnameleri, görevler ve Git tutarlı kalır. **Siz normal konuşursunuz; gerisini o halleder.**

**Üç temel söz:**

1. **🔄 Herkes devralabilir** — yapay zekâ aracını veya makineyi değiştir, bir komut söyle ve tam kaldığın yerden devam et. Projeyi yeniden anlatmak yok.
2. **🎯 İsteneni yap** — görev sınırları ve korunan yollar kapanışta mekanik olarak denetlenir, tasarım gerçekleri şartnamelere kilitlenir; gerisi kurallar ve incelemeyle korunur — sapma yakalanır, saatler sonra keşfedilmez.
3. **✅ «Bitti» gerçekten bitti demektir** — kapanış otomatik commit, push yapar ve **uzak SHA'yı doğrular** — artık «yerelde commitlendi ama GitHub'a gitmedi, yine de bitti deniyor» yok.

---

<a id="quickstart"></a>
## 🚀 Hızlı başlangıç (DeepSeek Harness — tek satır)

> DeepSeek Harness mi kullanıyorsun? İhtiyacın olan her şey bu.

```powershell
dsh plugin --profile web add @kakadeka/dsh-baton
```

1. DSH CLI'yi bir kez kur: `npm i -g @deepseek-ai/dsh`
2. Yukarıdaki satırı yapıştır, Enter'a bas.
3. `dsh`'ı yeniden başlat — bitti. 19 `baton_*` aracı artık profilinde aktif.

> GitHub'dan da kurulabilir: `dsh plugin --profile web add github:kakadeka/Baton`
> Onun yerine **Codex / Claude Code / Cursor** mu kullanıyorsun? [Diğer yapay zekâ araçları için kuruluma](#-install-for-other-ai-tools-codex--claude--cursor) geç.

---

## 📖 Senaryolar (her gereksinime bir tane, sancı → Baton'un yanıtı)

| # | Sancı | Baton'un yanıtı |
|---|---|---|
| 1 | Her sabah veya yeni makine: hangi dal? dün ne yapıldı? uzak güncel mi? | **clock in** de — otomatik git kontrolleri + güvenli senkron + devir teslimi/görevleri oku → görev tablosu → bir numara yanıtla |
| 2 | «Yerelde commitlendi ama push edilmedi»; gece elle PowerShell git | **clock out** de — doğrula → dokümanlar/hafıza/metrikler → commit → push → **«bitti»den önce uzak SHA == yerel HEAD** |
| 3 | Görev bitirmek ile «gün sonu» birbirine karıştı | **complete task** de — görevi kapat, sonuçları kaydet, sıradakini öner. Görev bitti ≠ gün sonu |
| 4 | Onaylanan tasarımlar unutuluyor; yapay zekâ doğaçlıyor | **save design spec** de — tasarım gerçeklerini uzun ömürlü şartnamelere kilitle (çakışmalar geçmişi korur); UI görevleri otomatik referans alır |
| 5 | Oturum kayboldu, yeni konuşma, her şeyi yeniden anlat | **continue work** de — görevi/dalı/blokeri/devir teslimi/sonraki adımı geri getir. Tek cümle, bitti |
| 6 | Birden çok iş; yapay zekâ öncelik belirlememeli; tam görev yazmak yorucu | Numaralı görev tablosu — `1`/`2`/`3` yanıtla |
| 7 | Uzun proje, geçmişe ulaşılamıyor; her şeyi yeniden okumak token yakar | Kararlar/tuzaklar/şartnameler otomatik dizinlenir; **dizini sorgula, yalnızca isabet eden parçayı oku** |
| 8 | Codex/Claude/Cursor bayrak yarışı — öncekinin ne yaptığını bilmeden | Birleşik devir teslim dosyası — dal/HEAD/değişiklikler/kısıtlar/sonraki adım. Son girdiyi oku, devam et |
| 9 | Her şey için pahalı model; zayıf model hata yapar; elle geçiş acı verir | Görev zorluğuna göre otomatik model yönlendirme — micro: ana oturum, normal: flash, karmaşık/inceleme: pro, yedek zincirlerle |
| 10 | «Hangi model gerçekten çalıştı?» faturalar tutmuyor | recommended ile actual ayrı kaydedilir, kaynak dürüstçe etiketlenir (sevk kaydı / ana bilgisayar tanımlayıcısı / bilinmiyor) |
| 11 | Saatlerce çalıştıktan sonra yapay zekâ prototipten sapıyor | Dondurulmuş gereksinimler + izinli/korunan yollar + mekanik kapsam denetimleri + bağımsız inceleme + tehlikeli git yok |
| 12 | Bir düğme rengini değiştirmek bir saat sürdü | Micro hızlı yol — delege yok, incelemeci yok, ilgisiz test yok. Basit görevler dakikalar sürer |
| 13 | Karmaşık görevler özensiz yazılmamalı | Yükselen kapılar: sözleşme, güçlü model, bağımsız incelemeci, donmuş şartnameye göre sadakat, geri alma planı |
| 14 | Ofis ve ev makineleri senkronsuz; yerel işi kaybetme korkusu | Güvenli fetch + ff-only senkron (asla üzerine yazmaz), otomatik commit/push, uzak SHA doğrulaması; force/reset/clean yasak |
| 15 | Hissiyatla model seçmek, gerçek veri yok | Her görev gerçek modeli ve tamamlanmayı kaydeder → aylık pano; henüz toplanmayan başarı/başarısızlık/süre «kaydedilmedi» olarak görünür, asla uydurulmaz |
| 16 | Sistemi yeni bir projeyle yeniden kullan/paylaş | Çerçeve ile proje örneği tamamen ayrı; `Baton init` tek seferlik kurulum; temizleme hattıyla paylaşım (anahtar/yol/özel not yok) |
| 17 | Proje kurallarını atlayan başka skiller kurulu | Harici skiller yardımcı olabilir ama proje sınırlarını (yollar, tasarım şartnameleri, git disiplini) AGENTS.md ile koordineli şekilde Baton uygular |

## ✨ Özellikler (8 yetenek bloğu)

- **Komut otomasyonu** — clock in / clock out / continue work / save design spec / complete task / update project docs / remember / Baton init / numara onayı / doğal dille git
- **Çapraz yapay zekâ ve çapraz makine** — düz metin proje gerçeği + tek komutluk ince adaptörler (Codex/Claude/Cursor) + devir teslim bayrak yarışı
- **Uzun ömürlü hafıza** — kararlar/tuzaklar/şartnameler otomatik arşivlenir + hafif dizin; kademeli okuma, toptan yeniden okuma yok
- **Sapma önleme** — DONDURULMUŞ kısıtlar + izinli/korunan yol denetimleri + yasaklı değişiklik listesi + bağımsız inceleme + tehlikeli git yok
- **Git doğruluk döngüsü** — ff-only senkron, otomatik commit/push, **uzak SHA == yerel HEAD**, yayın kaydı (`last_published_sha`)
- **Otomatik model yönlendirme** — görev seviyesi × kural tablosu (flash/pro + yüksek/en üst + yedek); recommended ile actual şeffafça kaydedilir
- **Aylık pano** — model sıralamaları / saatlik etkinlik / günlük detay / ajan detayı, gerçek çalıştırma verilerinden
- **Tek tık kabul** — `baton_accept`: iskelet/durum/güvenlik/hacim denetimleri → PASS/FAIL + engel listesi

## 🗣️ Komutlar (hangisini ne zaman kullanmalı)

Bu İngilizce ifadelerden herhangi birini söyle — anlam her yapay zekâda aynıdır. Çince tetikleyiciler Çince sürümdedir (yukarıdaki bağlantı).

| Komut | Ne zaman | Ne olur |
|---|---|---|
| **clock in** / *start work* | gün başı / yeni makine / yeni yapay zekâ | git kontrolleri → güvenli senkron → devir teslim ve görevler → görev tablosu |
| **clock out** / *end work* | iş günü sonu | doğrula → dokümanlar/hafıza/metrikler → commit → push → **uzak SHA doğrulaması** |
| **continue work** / *resume* | oturum kayboldu / araç değişti | görevi, dalı, blokeri, devir teslim sonunu, sonraki adımı geri getir |
| **save design spec** | bir tasarımı onayladıktan sonra | uzun ömürlü şartname + dizine kilitle; UI görevleri ona uyar |
| **complete task** | bir görev bitti, daha fazlası var | görevi kapat, sonucu kaydet, sıradakini öner (tam kapanış değil) |
| **update project docs** | iş ortasında kontrol noktası | ilerlemeyi + devir teslim kontrol noktasını yaz (çalışma alanı elde kalır) |
| **remember this pitfall** / *record this decision* | bir tuzağa düştün / bir karar verdin | uzun ömürlü hafızaya yaz + otomatik dizin |
| **Baton init** | yeni bir projede ilk kez | hafıza iskeleti + yapılandırma üret (asla üzerine yazmaz) |
| `1` / `2` / `3` yanıtla | görev tablosu gösterildi | numara geçerli görev olarak kalıcılaştırılır, sonra iş başlar |
| **release workspace** / *I confirm the previous agent stopped* | girişte sahiplik çakışması | tek yazar kilidini aç + serbest bırakma notu yaz |
| **pull github** / *sync github* / *check git status* | elle git niyeti | hafif git yolu, sözleşme/inceleme töreni yok |
| **check update** | Baton'un yeni sürümü var mı? | Yerel sürüm çapasını oku + GitHub/npm'den en son sürümü sorgula ve sonucu bildir |
| **update baton** / *upgrade baton* | Yeni sürüm yayınlandı | AI güncellemeyi eksiksiz yürütür (git pull + kurulumu yeniden çalıştır / npm update) ve yerel == uzak doğrular |

## 🛠️ Diğer yapay zekâ araçları için kurulum (Codex / Claude / Cursor)

> **Kurulum = bir komut kopyala, Enter'a bas, bitmesini bekle, sonra tek komutla doğrula.** Elle klasör oluşturmak yok, elle dosya kopyalamak yok.
> DeepSeek Harness kullanıcıları bu bölümü atlayabilir — yukarıdaki hızlı başlangıcı kullanın.

### Adım 0: Hangi kuruluma ihtiyacın olduğuna karar ver (10 saniye)

| Durumun | Bunu kur | Kurulumdan sonra |
|---|---|---|
| Birden çok proje — Baton bu makinedeki **her projede** kullanılabilir olsun | **Kullanıcı düzeyi** (makine başına bir kez) | Bu makinede global; her proje komutları tanır |
| Başka makinelerin/yapay zekâların devralmasını istediğin **belirli bir proje** | **Proje düzeyi** (proje başına bir kez) | Proje kendi hafıza iskeletini + 3 araç adaptörünü taşır; `git clone` et ve devam et |
| İkisi de | Önce kullanıcı düzeyi, sonra proje düzeyi | En eksiksizi |

> 💡 **Önerilen**: kullanıcı düzeyini çalıştır (30 sn), sonra gerçek projende proje düzeyini çalıştır (30 sn).

### Adım 1: Baton'u indir (bir kez)

PowerShell'i aç (`Win`'e bas, `powershell` yaz, Enter), bu satırı yapıştır:

```powershell
git clone https://github.com/kakadeka/Baton.git $HOME\Baton
```

> Git yok mu? https://git-scm.com/download/win adresinden kur, PowerShell'i yeniden aç, tekrar yapıştır.

### Adım 2: Bir kurulum türü seç ve komutunu yapıştır

**Seçenek A — Kullanıcı düzeyi (makine başına bir kez, tüm projeler)**

```powershell
pwsh -File $HOME\Baton\scripts\baton-install.ps1 -Scope User
```

`ok: [Codex] ...`, `ok: [Claude Code] ...`, `ok: [Cursor] ...` göreceksin — üç yapay zekâ aracının global skilli kuruldu.

**Seçenek B — Proje düzeyi (proje başına bir kez, projeyi taşınabilir yapar)**

```powershell
cd C:\your\project\path
pwsh -File $HOME\Baton\scripts\baton-install.ps1 -Scope Project
```

Başarı satırı (proje düzeyi kurulum tamamlandı) ve oluşturulan listeyi göreceksin (hafıza iskeleti `docs/ai_memory`, yapılandırma `.baton`, üç skill aynası ve `AGENTS.md` / `CLAUDE.md` / `.cursorrules` içindeki girdiler). `.git` yok derse, yazdırdığı `git init` komutlarını çalıştır.

> Proje düzeyi kurulum tamamen otomatiktir ve **DeepSeek Harness eklentisi olmadan da çalışır** (eklentisiz mod).

### Adım 3: Doğrula (önemli olan — tek komut)

Projede yapay zekâna şunu söyle:

```
clock in
```

**✅ Başarı**: yapay zekâ Baton'a göre davranır ve dal, HEAD, çalışma ağacı durumu, geçerli görev ve devir teslim özeti içeren bir durum raporu, ardından şuna benzer bir görev tablosu çıkarır —

```
Task table: 1) ...
```

**❌ Hiçbir şey olmuyor mu?** Sırayla kontrol et:

1. Hangi yapay zekâyı kullanıyorsun? Claude Code → `~\.claude\skills\baton\SKILL.md`; Codex → `~\.agents\skills\baton\SKILL.md`; Cursor → `~\.cursor\skills\baton\SKILL.md` (kullanıcı düzeyi kurulum üçünü de oluşturur)
2. Projede `.git` var mı? (yoksa `git init` + ilk commit)
3. Komut tam olarak **clock in** mi, başka bir şey yok mu?
4. Projede `docs/ai_memory/` var mı? (proje düzeyi kurulum oluşturur)

### Adım 4: Mevcut bir Baton projesine katıl (yeni makine / yeni yapay zekâ)

Yeni makinede: git'i kur → projeni `git clone` et → yapay zekâna şunu söyle:

```
clock in  veya  continue work
```

Hafıza, devir teslim ve görevler kodla birlikte gelir. Doğrudan devam et — kuracak başka bir şey yok.

### Tek tık betiği ne yapıyor (şeffaf)

| Mod | Otomatik yaptıkları |
|---|---|
| Kullanıcı düzeyi | `SKILL.md`'yi üç yapay zekâ aracının global skill klasörlerine kopyalar (Codex / Claude Code / Cursor) |
| Proje düzeyi | ① `docs/ai_memory/` iskeleti (revizyon günlüğü + arşiv diziniyle) ② `.baton/config.json` ③ `.gitignore` eklemesi ④ üç skill aynası ⑤ üç giriş segmenti (`AGENTS.md` / `CLAUDE.md` / `.cursorrules`, kurallarını asla ezmez) |

Idempotent: yeniden çalıştırmak mevcut dokümanlarını ve kurallarını asla ezmez; yalnızca eksikleri doldurur.

## 📁 Gerçeğin yaşadığı yer

```
project/
├── docs/ai_memory/            ← uzun ömürlü hafıza (Git senkronlu, yapay zekâdan bağımsız)
│   ├── index.md               ← önce beni oku
│   ├── current.md             ← şu an ne oluyor
│   ├── handoff_current.md     ← devir teslim günlüğü (son girdi = gerçek)
│   ├── state/                 ← tasks.json, archive_index.json, project_state.json
│   ├── knowledge/             ← tech_decision.md, pit_experience.md
│   ├── ui_spec/               ← tasarım şartnameleri
│   ├── daily_log/             ← günlük kayıtlar
│   └── agent_metrics/YYYY/MM/index.html  ← aylık pano
└── .baton/                    ← makineye özel (gitignored, config.json hariç): yapılandırma, metrikler, kanıtlar
```

## 🛡️ Güvenlik ve tasarım

- Tehlikeli git (force push / reset --hard / riskli clean / yetkisiz rebase) yoktur
- Senkronlar ff-only'dir; sapma durur ve raporlar; çakışmalar asla otomatik çözülmez
- Kimlik bilgileri asla Git / hafıza / metrikler / günlüklere girmez
- Geçmiş yalnızca eklenir veya «yerini aldı» diye işaretlenir — asla üzerine yazılmaz
- «Bitti» = mekanik kanıt (uzak SHA + yayın kaydı), bir iddia değil
- Token tasarrufu birinci sınıf hedeftir: önce dizin, riske göre modeller, sınırlı çıktılar, gereksiz çağrı yok

## 📦 Depo ve lisans

- Açık kaynak: https://github.com/kakadeka/Baton (yalnızca genel paket, temizleme hattıyla senkronlanır — özel plan, oturum notu veya kimlik bilgisi yok)
- npm: [@kakadeka/dsh-baton](https://www.npmjs.com/package/@kakadeka/dsh-baton)
- Lisans: [Apache-2.0](../LICENSE)
