// ==================== SUPABASE CONFIG ====================
var supabaseUrl = "https://rnllunfxsidqbjtojbjc.supabase.co";
var supabaseKey = "sb_publishable_xKbmQSrlq3nEhcGTvNy4Ng_OGYh8_it";
var supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ==================== GLOBAL VARIABLES ====================
let chart = null;
let chartKategori = null;
let chartTrend = null;
let editId = null;
let dbCategories = [];
let comparisonData = null;
let showMonthlyComparison = true;
let showYearlyComparison = true;
let currentUser = getCurrentUser();

// ==================== AUTHENTICATION ====================
function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch (e) {
        return null;
    }
}

// ==================== FORMAT FUNCTIONS ====================
function formatRupiah(angka) {
  if (angka === null || angka === undefined) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(angka);
}
function formatTanggal(tanggal) {
  if (!tanggal) return '-';
  const d = new Date(tanggal);
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
}
function parseCurrencyInput(value) {
  return parseInt(value.toString().replace(/[^0-9]/g, '')) || 0;
}

// ==================== UI HELPERS ====================
function adjustBalanceFontSize(element) {
  if (!element) return;
  const len = element.innerText.length;
  const isMobile = window.innerWidth <= 576;
  let size = len > 18 ? 14 : len > 15 ? 16 : len > 12 ? 18 : 20;
  if (isMobile) {
       size = len > 16 ? 11 : len > 13 ? 13 : 15;
       element.style.whiteSpace = 'normal';
       element.style.wordBreak = 'break-word';
   } else {
       element.style.whiteSpace = 'nowrap';
   }
   element.style.fontSize = size + 'px';
   element.style.lineHeight = '1.2';
}
function adjustAllBalanceCards() {
  document.querySelectorAll('.balance-card h3').forEach(el => adjustBalanceFontSize(el));
}
function setDefaultTanggal() {
  const el = document.getElementById("tanggal");
  if (el) el.value = new Date().toISOString().split('T')[0];
}
function setDefaultPeriode() {
  const bulan = document.getElementById("filterBulan");
  const tahun = document.getElementById("filterTahun");
  
  // Load dari localStorage jika ada
  const savedBulan = localStorage.getItem('selectedBulan');
  const savedTahun = localStorage.getItem('selectedTahun');
  
  const today = new Date();
  const defaultBulan = savedBulan || String(today.getMonth() + 1).padStart(2, '0');
  const defaultTahun = savedTahun || today.getFullYear();
  
  if (bulan) bulan.value = defaultBulan;
  if (tahun) tahun.value = defaultTahun;
}
function resetForm() {
  editId = null;
  const elK = document.getElementById("kategori");
  const elJ = document.getElementById("jumlah");
  const elKet = document.getElementById("keterangan");
  const elBtn = document.getElementById("btnSimpan");
  if (elK) elK.value = "";
  if (elJ) elJ.value = "";
  if (elKet) elKet.value = "";
  if (elBtn) elBtn.innerHTML = '<i class="bi bi-save"></i> Simpan';
  setDefaultTanggal();
}

// ==================== PERIOD PERSISTENCE ====================
function savePeriodSelection() {
  const bulanEl = document.getElementById("filterBulan");
  const tahunEl = document.getElementById("filterTahun");
  if (bulanEl && tahunEl) {
    localStorage.setItem('selectedBulan', bulanEl.value);
    localStorage.setItem('selectedTahun', tahunEl.value);
  }
}

// ==================== CATEGORY FUNCTIONS ====================

async function fetchCategoriesFromDB() {
    try {
        let { data, error } = await supabaseClient
            .from("kategori")
            .select("nama_kategori")
            .order("nama_kategori", { ascending: true });
        
        if (error || !data) {
            // Fallback list
            dbCategories = ['Makanan','Transportasi','Belanja','Kesehatan','Pendidikan','Hiburan','Tagihan','Payroll','Investasi','Lain-lain'];
        } else {
            dbCategories = data.map(r => r.nama_kategori).filter(Boolean);
        }
        updateDatalist();
    } catch (e) {
        console.error('Error fetching categories:', e);
    }
}

function initCategoryLookup() {
    const sug = document.getElementById('kategoriSuggestions');
    const input = document.getElementById('kategori');
    if (!sug || !input) return;

    fetchCategoriesFromDB();

    input.addEventListener('input', function() {
        const val = this.value.toLowerCase().trim();
        sug.innerHTML = '';
        
        if (!val) { 
            sug.classList.remove('show'); 
            return; 
        }

        // Find matches that are NOT the exact value
        const matches = dbCategories.filter(c => c.toLowerCase().includes(val));
        
        matches.forEach(c => {
            const d = document.createElement('div');
            d.innerHTML = `<i class="bi bi-tag"></i> ${c}`;
            d.onclick = () => {
                input.value = c;
                sug.classList.remove('show');
            };
            sug.appendChild(d);
        });

        // Check for exact match to decide whether to show "Add New"
        const exactMatch = dbCategories.some(c => c.toLowerCase() === val);
        if (!exactMatch && val.length > 0) {
            const addDiv = document.createElement('div');
            addDiv.className = 'add-new';
            addDiv.innerHTML = `<i class="bi bi-plus-circle"></i> Tambah manual: "<b>${input.value}</b>"`;
            addDiv.onclick = async () => {
                await addNewCategory(input.value);
                sug.classList.remove('show');
            };
            sug.appendChild(addDiv);
        }

        if (sug.children.length > 0) {
            sug.classList.add('show');
        } else {
            sug.classList.remove('show');
        }
    });

    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !sug.contains(e.target)) {
            sug.classList.remove('show');
        }
    });
}

function updateDatalist() {
    const datalist = document.getElementById('kategoriList');
    if (!datalist) return;
    datalist.innerHTML = dbCategories.map(c => `<option value="${c}">`).join('');
}

async function addNewCategory(cat) {
    if (!cat || !cat.trim()) return;
    const name = cat.trim();
    
    // Final check for duplicates before insert (case-insensitive)
    const exists = dbCategories.some(c => c.toLowerCase() === name.toLowerCase());
    
    if (!exists) {
        try {
            const { error } = await supabaseClient
                .from("kategori")
                .insert([{ nama_kategori: name }]);
            
            if (!error) {
                dbCategories.push(name);
                dbCategories.sort();
                updateDatalist();
            }
        } catch(e) { 
            console.error('Error adding category:', e); 
        }
    }
    
    // Set the input value to the category name regardless
    document.getElementById('kategori').value = name;
}

// ==================== CURRENCY INPUT ====================
function initCurrencyInput() {
  const input = document.getElementById('jumlah');
  if (!input) return;
  input.addEventListener('input', function() {
    let v = this.value.replace(/[^0-9]/g, '');
    if (v) this.value = new Intl.NumberFormat('id-ID').format(parseInt(v));
  });
  input.addEventListener('blur', function() {
    if (this.value) this.value = new Intl.NumberFormat('id-ID').format(parseInt(this.value.replace(/[^0-9]/g, '')));
  });
  input.addEventListener('focus', function() {
    if (this.value) this.value = this.value.replace(/[^0-9]/g, '');
  });
}

// ==================== TOGGLE SECTION ====================
function toggleSection(sectionId, btn) {
  // Hide all sections first for a cleaner transition if desired, 
  // or keep current behavior of multiple sections open.
  // User asked for a "cool sidebar", usually that implies switching views.
  
  const sections = ['sectionGrafik', 'sectionSummary', 'sectionTransaksi', 'sectionPembanding'];
  sections.forEach(id => {
    const s = document.getElementById(id);
    if (s) s.classList.add('collapsed');
  });

  const sec = document.getElementById(sectionId);
  if (!sec) return;

  sec.classList.remove('collapsed');
  
  // Update active state in sidebar
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  if (btn) btn.classList.add('active');

  setTimeout(() => {
    if (sectionId === 'sectionGrafik') loadData();
    if (sectionId === 'sectionTransaksi') loadData();
    if (sectionId === 'sectionPembanding') { initComparisonYearDropdown(); generateComparison(); }
    if (sectionId === 'sectionSummary') generateSummaryCategory();
  }, 150);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('show');
        overlay.classList.toggle('show');
    }
}

function toggleSidebarMobile() {
    if (window.innerWidth <= 1024) {
        toggleSidebar();
    }
}

function toggleSidebarCollapse() {
    const sidebar = document.getElementById('sidebar');
    const isCollapsed = sidebar.classList.toggle('is-collapsed');
    
    localStorage.setItem('sidebarCollapsed', isCollapsed);
    
    // Adjust charts and layout after transition
    setTimeout(() => {
        adjustAllBalanceCards();
        if (chart) chart.resize();
        if (chartKategori) chartKategori.resize();
        if (chartTrend) chartTrend.resize();
    }, 300);
}

// ==================== THEME FUNCTIONS ====================
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    const icon = document.querySelector('#themeToggle i');
    if (icon) {
        icon.className = theme === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars';
    }
    
    // Update Chart defaults
    updateChartTheme(theme);
    
    // Redraw charts if they exist
    if (chart) loadData(); // Reload data will redraw charts with new theme colors
}

function updateChartTheme(theme) {
    if (typeof Chart === 'undefined') return;
    
    const textColor = theme === 'dark' ? '#94a3b8' : '#64748b';
    const gridColor = theme === 'dark' ? '#334155' : '#e2e8f0';
    
    Chart.defaults.color = textColor;
    Chart.defaults.scale.grid.color = gridColor;
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
}

// ==================== LOAD DATA (DIPERBAIKI & DEFENSIF) ====================
async function loadData() {
  const tblEl = document.getElementById("tabelTransaksi");
  if (!tblEl) return; // Halaman tidak punya tabel, berhenti aman

  const bulanEl = document.getElementById("filterBulan");
  const tahunEl = document.getElementById("filterTahun");
  const loadingTable = document.getElementById('loadingTable');
  const countEl = document.getElementById("transactionCount");

  if (loadingTable) loadingTable.classList.add('show');

  const bulan = bulanEl?.value;
  const tahun = tahunEl?.value;
  
  // Simpan pilihan periode ke localStorage
  if (bulan && tahun) {
    savePeriodSelection();
  }
  
  let awal = null, akhir = null;
  if (bulan && tahun) {
    awal = `${tahun}-${bulan}-01`;
    const last = new Date(tahun, parseInt(bulan), 0).getDate();
    akhir = `${tahun}-${bulan}-${String(last).padStart(2,'0')}`;
  }

  let opening = 0;
  if (awal) {
    const { data: before } = await supabaseClient.from("transaksi").select("jenis, jumlah").lt("tanggal", awal).eq("user_id", currentUser.id);
    if (before) before.forEach(r => { opening += r.jenis === "Masuk" ? (r.jumlah||0) : -(r.jumlah||0); });
  }

  let query = supabaseClient.from("transaksi").select("id, tanggal, jenis, kategori, jumlah, keterangan").eq("user_id", currentUser.id).order("tanggal", { ascending: true });
  if (awal && akhir) query = query.gte("tanggal", awal).lte("tanggal", akhir);

  const { data, error } = await query;
  if (loadingTable) loadingTable.classList.remove('show');
  if (error) { tblEl.innerHTML = `<tr><td colspan="7" class="text-center text-danger">❌ ${error.message}</td></tr>`; return; }

  let html = "", masuk = 0, keluar = 0, saldo = opening;
  if (!data || data.length === 0) {
    tblEl.innerHTML = `<tr><td colspan="7" class="text-center text-muted">📭 Belum ada transaksi</td></tr>`;
    if (countEl) countEl.innerText = "0 transaksi";
    updateBalanceCards(opening, 0, 0, opening, 0);
    return;
  }

  data.forEach(r => {
    const amt = r.jumlah || 0;
    if (r.jenis === "Masuk") { masuk += amt; saldo += amt; } else { keluar += amt; saldo -= amt; }
    const cls = r.jenis === "Masuk" ? "success" : "danger";
    html += `<tr>
      <td><small>${formatTanggal(r.tanggal)}</small></td>
      <td><span class="badge bg-${cls}">${r.jenis}</span></td>
      <td>${r.kategori || '-'}</td>
      <td class="text-end fw-bold text-${cls}">${formatRupiah(amt)}</td>
      <td><small>${r.keterangan || '-'}</small></td>
      <td class="text-end"><small>${formatRupiah(saldo)}</small></td>
      <td class="text-center">
        <button class="btn btn-warning btn-sm py-0 px-2 me-1" onclick='editData("${r.id}", "${r.tanggal}", "${r.jenis}", "${r.kategori}", "${r.jumlah}", "${r.keterangan||""}")'><i class="bi bi-pencil"></i></button>
        <button class="btn btn-danger btn-sm py-0 px-2" onclick="hapusData('${r.id}')"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`;
  });

  tblEl.innerHTML = html;
  const ending = opening + (masuk - keluar);
  if (countEl) countEl.innerText = `${data.length} transaksi`;
  updateBalanceCards(opening, masuk, keluar, ending, data.length);

  // Update visualizations if sections are open
  if (!document.getElementById('sectionGrafik').classList.contains('collapsed')) {
    buatChart(masuk, keluar);
    buatChartKategori(data);
    buatTrend();
  }
  if (!document.getElementById('sectionSummary').classList.contains('collapsed')) {
    generateSummaryCategory(data);
  }
}

function updateBalanceCards(o, m, k, e, t) {
  const el = id => document.getElementById(id);
  if(el("openingBalance")) el("openingBalance").innerText = formatRupiah(o);
  if(el("totalMasuk")) el("totalMasuk").innerText = formatRupiah(m);
  if(el("totalKeluar")) el("totalKeluar").innerText = formatRupiah(k);
  if(el("endingBalance")) el("endingBalance").innerText = formatRupiah(e);
  setTimeout(adjustAllBalanceCards, 100);
}

// ==================== SAVE, EDIT, DELETE ====================
async function simpan() {
  const tanggal = document.getElementById("tanggal")?.value;
  const jenis = document.getElementById("jenis")?.value;
  const kategori = document.getElementById("kategori")?.value.trim();
  const jumlah = parseCurrencyInput(document.getElementById("jumlah")?.value || "");
  const keterangan = document.getElementById("keterangan")?.value.trim();
  if (!tanggal || !kategori || !jumlah) { alert("⚠️ Data belum lengkap!"); return; }

  const payload = { tanggal, jenis, kategori, jumlah, keterangan: keterangan || null, user_id: currentUser.id };
  try {
    const { error } = editId 
      ? await supabaseClient.from("transaksi").update(payload).eq("id", editId)
      : await supabaseClient.from("transaksi").insert([payload]);
    if (error) throw error;
    alert(editId ? "✅ Data diupdate" : "✅ Data disimpan");
    resetForm(); loadData();
  } catch(e) { alert("❌ " + e.message); }
}

function editData(id, t, j, k, n, ket) {
  editId = id;
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
  set("tanggal", t); set("jenis", j); set("kategori", k);
  set("jumlah", n ? new Intl.NumberFormat('id-ID').format(n) : ""); set("keterangan", ket);
  document.getElementById("btnSimpan").innerHTML = '<i class="bi bi-pencil"></i> Update';
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function hapusData(id) {
  if (!confirm("⚠️ Yakin ingin menghapus data ini?")) return;
  
  try {
    // Hapus dengan kondisi yang ketat untuk keamanan
    const { error } = await supabaseClient
      .from("transaksi")
      .delete()
      .eq("id", id)
      .eq("user_id", currentUser.id);
    
    if (error) {
      console.error('Delete error:', error);
      if (error.code === '42501') {
        alert("❌ Izin hapus ditolak. Hubungi admin atau periksa policy DELETE di Supabase.");
      } else {
        alert("❌ Gagal menghapus: " + error.message);
      }
      return;
    }
    
    alert("✅ Data berhasil dihapus");
    loadData();
  } catch(e) {
    console.error('Exception on delete:', e);
    alert("❌ Error: " + e.message);
  }
}

// ==================== CHARTS & SUMMARY (Dipotong demi ringkas, logic aman) ====================
function initYearDropdown() {
  const el = document.getElementById("filterTahun");
  if (!el) return;
  el.innerHTML = '';
  const cy = new Date().getFullYear();
  // Provide 10 years back and 5 years forward for better flexibility
  for(let y=cy-10; y<=cy+5; y++) {
    const opt = document.createElement('option');
    opt.value = y; opt.innerText = y;
    if(y===cy) opt.selected = true;
    el.appendChild(opt);
  }
}
function initComparisonYearDropdown() {
  const el = document.getElementById("filterTahunPembanding");
  if(!el) return;
  el.innerHTML = '';
  const cy = new Date().getFullYear();
  // Provide 10 years back and 5 years forward
  for(let y=cy-10; y<=cy+5; y++) {
    const opt = document.createElement('option');
    opt.value = y; opt.innerText = y;
    if(y===cy) opt.selected = true;
    el.appendChild(opt);
  }
  const bm = document.getElementById("filterBulanPembanding");
  if(bm) bm.value = String(new Date().getMonth()+1).padStart(2,'0');
}

function toggleComparisonView() {
    showMonthlyComparison = document.getElementById('checkBulanan').checked;
    showYearlyComparison = document.getElementById('checkTahunan').checked;
    if (comparisonData) {
        renderComparisonCards(document.getElementById('comparisonContainer'));
    }
}

async function generateComparison() {
    const container = document.getElementById('comparisonContainer');
    const categoryBody = document.getElementById('categoryComparisonBody');
    const recommendationContainer = document.getElementById('recommendationContainer');
    
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-warning"></div><p class="mt-2">Memuat data perbandingan...</p></div>';
    
    try {
        const bulan = document.getElementById('filterBulanPembanding').value;
        const tahun = document.getElementById('filterTahunPembanding').value;
        
        const currentPeriod = await getPeriodData(tahun, bulan);
        const prevMonthData = await getPreviousMonthData(tahun, bulan);
        const prevYearData = await getPreviousYearData(tahun, bulan);
        const currentYearData = await getYearData(tahun);
        const prevYearTotalData = await getYearData(parseInt(tahun) - 1);
        
        comparisonData = {
            current: currentPeriod,
            prevMonth: prevMonthData,
            prevYear: prevYearData,
            currentYear: currentYearData,
            prevYearTotal: prevYearTotalData
        };
        
        renderComparisonCards(container);
        renderCategoryComparison(categoryBody, currentPeriod, prevMonthData);
        generateRecommendations(recommendationContainer, currentPeriod, prevMonthData, prevYearData);
    } catch (error) {
        container.innerHTML = `<div class="alert alert-danger">❌ Error: ${error.message}</div>`;
        console.error('Comparison error:', error);
    }
}

async function getPeriodData(tahun, bulan) {
    const awal = `${tahun}-${bulan}-01`;
    const lastDay = new Date(tahun, parseInt(bulan), 0).getDate();
    const akhir = `${tahun}-${bulan}-${String(lastDay).padStart(2, '0')}`;
    
    const { data, error } = await supabaseClient
        .from('transaksi')
        .select('tanggal, jenis, kategori, jumlah')
        .eq('user_id', currentUser.id)
        .gte('tanggal', awal)
        .lte('tanggal', akhir);
    
    if (error || !data) return { masuk: 0, keluar: 0, categories: {} };
    
    let masuk = 0, keluar = 0;
    const categories = {};
    
    data.forEach(row => {
        const amount = row.jumlah || 0;
        if (row.jenis === 'Masuk') {
            masuk += amount;
        } else {
            keluar += amount;
        }
        
        if (row.kategori) {
            const normalizedCat = row.kategori.trim();
            categories[normalizedCat] = (categories[normalizedCat] || 0) + amount;
        }
    });
    
    return { masuk, keluar, categories, saldo: masuk - keluar };
}

async function getPreviousMonthData(tahun, bulan) {
    let prevBulan = parseInt(bulan) - 1;
    let prevTahun = parseInt(tahun);
    if (prevBulan === 0) {
        prevBulan = 12;
        prevTahun = prevTahun - 1;
    }
    return await getPeriodData(String(prevTahun), String(prevBulan).padStart(2, '0'));
}

async function getPreviousYearData(tahun, bulan) {
    const prevTahun = parseInt(tahun) - 1;
    return await getPeriodData(String(prevTahun), bulan);
}

async function getYearData(tahun) {
    const awal = `${tahun}-01-01`;
    const akhir = `${tahun}-12-31`;
    
    const { data, error } = await supabaseClient
        .from('transaksi')
        .select('tanggal, jenis, kategori, jumlah')
        .eq('user_id', currentUser.id)
        .gte('tanggal', awal)
        .lte('tanggal', akhir);
    
    if (error || !data) return { masuk: 0, keluar: 0, categories: {} };
    
    let masuk = 0, keluar = 0;
    const categories = {};
    
    data.forEach(row => {
        const amount = row.jumlah || 0;
        if (row.jenis === 'Masuk') {
            masuk += amount;
        } else {
            keluar += amount;
            if (row.kategori) {
                const normalizedCat = row.kategori.trim();
                categories[normalizedCat] = (categories[normalizedCat] || 0) + amount;
            }
        }
    });
    
    return { masuk, keluar, categories, saldo: masuk - keluar };
}

function calculateChange(current, previous) {
    if (previous === 0) {
        return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
}

function formatPercentage(percentage, isExpense = true) {
    const absPercentage = Math.abs(percentage).toFixed(1);
    const isIncrease = percentage > 0;
    const isDecrease = percentage < 0;
    
    let isGood, colorClass, icon;
    if (isExpense) {
        isGood = isDecrease;
        colorClass = isGood ? 'text-success' : 'text-danger';
        icon = isIncrease ? '↑' : '↓';
    } else {
        isGood = isIncrease;
        colorClass = isGood ? 'text-success' : 'text-danger';
        icon = isIncrease ? '↑' : '↓';
    }
    
    const sign = isDecrease ? '-' : '';
    return `<span class="${colorClass} fw-bold text-nowrap">${icon} ${sign}${absPercentage}%</span>`;
}

function formatChangeDescription(percentage, isExpense = true) {
    if (percentage === 0) {
        return '<span class="badge bg-secondary text-nowrap">→ Stabil</span>';
    }
    const isIncrease = percentage > 0;
    const isDecrease = percentage < 0;
    
    let text, badgeClass;
    if (isExpense) {
        if (isIncrease) {
            text = '⚠️ Peningkatan';
            badgeClass = 'bg-danger';
        } else {
            text = '✅ Penurunan';
            badgeClass = 'bg-success';
        }
    } else {
        if (isIncrease) {
            text = '✅ Peningkatan';
            badgeClass = 'bg-success';
        } else {
            text = '⚠️ Penurunan';
            badgeClass = 'bg-danger';
        }
    }
    return `<span class="badge ${badgeClass} text-nowrap">${text}</span>`;
}

function renderComparisonCards(container) {
    if (!comparisonData) return;
    const { current, prevMonth, currentYear, prevYearTotal } = comparisonData;
    let html = '';
    
    if (showMonthlyComparison) {
        const monthChangeMasuk = calculateChange(current.masuk, prevMonth.masuk);
        const monthChangeKeluar = calculateChange(current.keluar, prevMonth.keluar);
        const monthChangeSaldo = calculateChange(current.saldo, prevMonth.saldo);
        
        html += `
        <div class="card bg-light mb-3">
            <div class="card-header bg-warning">
                <h6 class="mb-0">📅 Bulan Ini vs Bulan Lalu</h6>
            </div>
            <div class="card-body">
                <div class="row text-center">
                    <div class="col-md-4 col-sm-12 mb-2">
                        <div class="p-3 border rounded comparison-card">
                            <small class="text-muted d-block mb-1">Pemasukan</small>
                            <h4 class="text-success mb-1 text-nowrap">${formatRupiah(current.masuk)}</h4>
                            <div class="small">${formatPercentage(monthChangeMasuk, false)}</div>
                            <div class="text-muted small text-nowrap">vs ${formatRupiah(prevMonth.masuk)}</div>
                            <div class="mt-1">${formatChangeDescription(monthChangeMasuk, false)}</div>
                        </div>
                    </div>
                    <div class="col-md-4 col-sm-12 mb-2">
                        <div class="p-3 border rounded comparison-card">
                            <small class="text-muted d-block mb-1">Pengeluaran</small>
                            <h4 class="text-danger mb-1 text-nowrap">${formatRupiah(current.keluar)}</h4>
                            <div class="small">${formatPercentage(monthChangeKeluar, true)}</div>
                            <div class="text-muted small text-nowrap">vs ${formatRupiah(prevMonth.keluar)}</div>
                            <div class="mt-1">${formatChangeDescription(monthChangeKeluar, true)}</div>
                        </div>
                    </div>
                    <div class="col-md-4 col-sm-12 mb-2">
                        <div class="p-3 border rounded comparison-card">
                            <small class="text-muted d-block mb-1">Saldo Bersih</small>
                            <h4 class="${current.saldo >= 0 ? 'text-success' : 'text-danger'} mb-1 text-nowrap">${formatRupiah(current.saldo)}</h4>
                            <div class="small">${formatPercentage(monthChangeSaldo, false)}</div>
                            <div class="text-muted small text-nowrap">vs ${formatRupiah(prevMonth.saldo)}</div>
                            <div class="mt-1">${formatChangeDescription(monthChangeSaldo, false)}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    }
    
    if (showYearlyComparison) {
        const yearChangeMasuk = calculateChange(currentYear.masuk, prevYearTotal.masuk);
        const yearChangeKeluar = calculateChange(currentYear.keluar, prevYearTotal.keluar);
        const yearChangeSaldo = calculateChange(currentYear.saldo, prevYearTotal.saldo);
        
        html += `
        <div class="card bg-light mb-3">
            <div class="card-header bg-info text-white">
                <h6 class="mb-0">📆 Tahun Ini vs Tahun Lalu</h6>
            </div>
            <div class="card-body">
                <div class="row text-center">
                    <div class="col-md-4 col-sm-12 mb-2">
                        <div class="p-3 border rounded comparison-card">
                            <small class="text-muted d-block mb-1">Pemasukan Tahunan</small>
                            <h4 class="text-success mb-1 text-nowrap">${formatRupiah(currentYear.masuk)}</h4>
                            <div class="small">${formatPercentage(yearChangeMasuk, false)}</div>
                            <div class="text-muted small text-nowrap">vs ${formatRupiah(prevYearTotal.masuk)}</div>
                            <div class="mt-1">${formatChangeDescription(yearChangeMasuk, false)}</div>
                        </div>
                    </div>
                    <div class="col-md-4 col-sm-12 mb-2">
                        <div class="p-3 border rounded comparison-card">
                            <small class="text-muted d-block mb-1">Pengeluaran Tahunan</small>
                            <h4 class="text-danger mb-1 text-nowrap">${formatRupiah(currentYear.keluar)}</h4>
                            <div class="small">${formatPercentage(yearChangeKeluar, true)}</div>
                            <div class="text-muted small text-nowrap">vs ${formatRupiah(prevYearTotal.keluar)}</div>
                            <div class="mt-1">${formatChangeDescription(yearChangeKeluar, true)}</div>
                        </div>
                    </div>
                    <div class="col-md-4 col-sm-12 mb-2">
                        <div class="p-3 border rounded comparison-card">
                            <small class="text-muted d-block mb-1">Saldo Bersih Tahunan</small>
                            <h4 class="${currentYear.saldo >= 0 ? 'text-success' : 'text-danger'} mb-1 text-nowrap">${formatRupiah(currentYear.saldo)}</h4>
                            <div class="small">${formatPercentage(yearChangeSaldo, false)}</div>
                            <div class="text-muted small text-nowrap">vs ${formatRupiah(prevYearTotal.saldo)}</div>
                            <div class="mt-1">${formatChangeDescription(yearChangeSaldo, false)}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    }
    
    container.innerHTML = html;
}

function renderCategoryComparison(container, current, prevMonth) {
    if (!container) return;
    
    // Include all categories from database + any categories found in transactions
    const allCategories = new Set([...dbCategories, ...Object.keys(current.categories), ...Object.keys(prevMonth.categories)]);
    
    if (allCategories.size === 0) {
        container.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3"><small>Belum ada data kategori</small></td></tr>';
        return;
    }
    
    let tableRows = '';
    const sortedCategories = Array.from(allCategories).sort();
    
    sortedCategories.forEach(category => {
        const currentAmount = current.categories[category] || 0;
        const prevAmount = prevMonth.categories[category] || 0;
        const selisih = currentAmount - prevAmount;
        const change = calculateChange(currentAmount, prevAmount);
        
        const selisihFormatted = selisih >= 0 ? 
            `<span class="text-danger text-nowrap">+${formatRupiah(selisih)}</span>` : 
            `<span class="text-success text-nowrap">${formatRupiah(selisih)}</span>`;
        
        tableRows += `
            <tr>
                <td class="fw-bold text-nowrap">${category}</td>
                <td class="text-end fw-bold text-nowrap">${formatRupiah(currentAmount)}</td>
                <td class="text-end text-nowrap">${formatRupiah(prevAmount)}</td>
                <td class="text-end text-nowrap">${selisihFormatted}</td>
                <td class="text-end text-nowrap">${formatPercentage(change, true)}</td>
                <td class="text-center text-nowrap">${formatChangeDescription(change, true)}</td>
            </tr>
        `;
    });
    
    container.innerHTML = tableRows;
}

function generateRecommendations(container, current, prevMonth, prevYear) {
    if (!container) return;
    const recommendations = [];
    
    const incomeChange = calculateChange(current.masuk, prevMonth.masuk);
    if (incomeChange < -10) {
        recommendations.push({ type: 'warning', icon: '⚠️', title: 'Pemasukan Menurun', message: `Pemasukan Anda turun ${Math.abs(incomeChange).toFixed(1)}% dari bulan lalu.` });
    }
    
    const expenseChange = calculateChange(current.keluar, prevMonth.keluar);
    if (expenseChange > 15) {
        recommendations.push({ type: 'danger', icon: '🚨', title: 'Pengeluaran Meningkat Tajam', message: `Pengeluaran naik ${expenseChange.toFixed(1)}%.` });
    }
    
    container.innerHTML = recommendations.map(rec => `
        <div class="alert alert-${rec.type} d-flex align-items-start">
            <span class="me-2" style="font-size: 1.5rem;">${rec.icon}</span>
            <div>
                <strong>${rec.title}</strong>
                <p class="mb-0 small">${rec.message}</p>
            </div>
        </div>
    `).join('') || '<div class="alert alert-info">✅ Keuangan Stabil</div>';
}

// Chart & Visualization Functions
function buatChart(masuk, keluar) {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById("chartKeuangan");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (chart) chart.destroy();
  
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ["Pemasukan", "Pengeluaran"],
      datasets: [{
        data: [masuk, keluar],
        backgroundColor: ['#198754', '#dc3545'],
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });
  updateStatusBox(masuk, keluar);
  updateChartInfo(masuk, keluar);
}

function updateChartInfo(masuk, keluar) {
  const saldo = masuk - keluar;
  if(document.getElementById('infoPemasukan')) document.getElementById('infoPemasukan').innerText = formatRupiah(masuk);
  if(document.getElementById('infoPengeluaran')) document.getElementById('infoPengeluaran').innerText = formatRupiah(keluar);
  if(document.getElementById('infoSaldoValue')) document.getElementById('infoSaldoValue').innerText = formatRupiah(saldo);
  const el = document.getElementById('infoSaldo');
  if(el) el.className = `info-box p-3 rounded bg-${saldo >= 0 ? 'success' : 'danger'} bg-gradient text-white`;
}

function updateStatusBox(masuk, keluar) {
  const box = document.getElementById("statusBox");
  if (!box) return;
  if (!masuk && !keluar) { box.innerText = "⚪ Belum ada transaksi"; box.className = "p-3 rounded fw-bold status-kosong"; return; }
  const isBaik = masuk > keluar;
  box.innerText = isBaik ? "🟢 Keuangan Membaik" : "🔴 Keuangan Boros";
  box.className = `p-3 rounded fw-bold status-${isBaik ? 'baik' : 'boros'}`;
}

function buatChartKategori(data) {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById("chartKategori");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (chartKategori) chartKategori.destroy();
  
  const map = {};
  data.forEach(r => { if(r.jenis==='Keluar') map[r.kategori] = (map[r.kategori]||0) + r.jumlah; });
  const labels = Object.keys(map);
  const values = Object.values(map);
  
  chartKategori = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{ data: values, backgroundColor: ['#667eea','#764ba2','#f093fb','#f5576c','#38ef7d'] }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}

async function buatTrend() {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById("chartTrend");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (chartTrend) chartTrend.destroy();
  
  const { data } = await supabaseClient.from("transaksi").select("tanggal, jenis, jumlah").eq("user_id", currentUser.id).order("tanggal", { ascending: true });
  const monthly = {};
  data?.forEach(r => {
    if (r.jenis === 'Masuk') {
      const p = r.tanggal.substring(0,7); // format: YYYY-MM
      if(!monthly[p]) monthly[p] = 0;
      monthly[p] += r.jumlah;
    }
  });
  
  chartTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Object.keys(monthly),
      datasets: [{ label: 'Pemasukan', data: Object.values(monthly), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4 }]
    },
    options: { responsive: true }
  });
}

function generateSummaryCategory(data) {
  const container = document.getElementById('summaryContainer');
  if (!container) return;
  const summary = {};
  data.forEach(r => {
    if(!summary[r.kategori]) summary[r.kategori] = { masuk:0, keluar:0, count:0 };
    summary[r.kategori].count++;
    if(r.jenis==='Masuk') summary[r.kategori].masuk += r.jumlah;
    else summary[r.kategori].keluar += r.jumlah;
  });
  
  container.innerHTML = Object.entries(summary).map(([k, s]) => `
    <div class="col-md-4">
      <div class="card p-3 mb-3">
        <h6>${k}</h6>
        <div class="small">Masuk: <span class="text-success">${formatRupiah(s.masuk)}</span></div>
        <div class="small">Keluar: <span class="text-danger">${formatRupiah(s.keluar)}</span></div>
      </div>
    </div>
  `).join('');
}

async function exportExcel() {
    try {
        const { data, error } = await supabaseClient
            .from('transaksi')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('tanggal', { ascending: true });

        if (error) throw error;
        if (!data || data.length === 0) {
            alert('Tidak ada data untuk dieksport');
            return;
        }

        // Format data like a bank statement
        let runningBalance = 0;
        const formattedData = data.map((row, index) => {
            const amount = row.jumlah || 0;
            const isMasuk = row.jenis === 'Masuk';
            
            if (isMasuk) runningBalance += amount;
            else runningBalance -= amount;

            return {
                'No': index + 1,
                'Tanggal': row.tanggal,
                'Keterangan': row.keterangan || '-',
                'Kategori': row.kategori || '-',
                'Pemasukan (CR)': isMasuk ? amount : 0,
                'Pengeluaran (DB)': !isMasuk ? amount : 0,
                'Saldo': runningBalance
            };
        });

        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(formattedData);
        
        // Add styling/formatting hints if possible (XLSX basic doesn't support much styling without extra plugins, but we can set column widths)
        const wscols = [
            {wch: 5},  // No
            {wch: 12}, // Tanggal
            {wch: 30}, // Keterangan
            {wch: 15}, // Kategori
            {wch: 15}, // Pemasukan
            {wch: 15}, // Pengeluaran
            {wch: 18}  // Saldo
        ];
        ws['!cols'] = wscols;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Mutasi Keuangan");
        
        // Download file
        const fileName = `Mutasi_Keuangan_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);

    } catch (error) {
        console.error('Export error:', error);
        alert('Gagal mengeksport data: ' + error.message);
    }
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initYearDropdown();
  initComparisonYearDropdown();
  initCategoryLookup();
  initCurrencyInput();
  setDefaultTanggal();
  setDefaultPeriode();
  // Apply saved sidebar state
  const sidebar = document.getElementById('sidebar');
  if (sidebar && localStorage.getItem('sidebarCollapsed') === 'true') {
    sidebar.classList.add('is-collapsed');
  }
  
  // Jalankan loadData jika di halaman Dashboard (ada tabelTransaksi)
  if (document.getElementById('tabelTransaksi')) {
    loadData();
  }

  // Event listener untuk menutup sugesti kategori saat klik di luar
  document.addEventListener('click', e => {
    if (!e.target.closest('.category-container') && !e.target.closest('#kategoriSuggestions')) {
      document.getElementById('kategoriSuggestions')?.classList.remove('show');
    }
  });

  // Responsive chart resize
  window.addEventListener('resize', () => {
    setTimeout(adjustAllBalanceCards, 100);
    if (chart) chart.resize();
    if (chartKategori) chartKategori.resize();
    if (chartTrend) chartTrend.resize();
  });
  
  console.log("💰 Dashboard loaded safely!");
});

console.log("💰 Dashboard loaded safely!");

// Pastikan kode ini ada di bagian paling bawah script.js Anda
document.addEventListener('DOMContentLoaded', function() {
    const welcomeElement = document.getElementById('welcomeMessage');
    const userRaw = localStorage.getItem('user');

    if (userRaw && welcomeElement) {
        let username = "";
        try {
            // Coba parse jika data berbentuk JSON {"username": "Nama"}
            const userData = JSON.parse(userRaw);
            username = userData.username || userData;
        } catch (e) {
            // Jika data hanya string biasa
            username = userRaw.replace(/"/g, '');
        }

        // Tampilkan teks sesuai permintaan
        welcomeElement.innerHTML = `Selamat Datang <strong>"${username}"</strong>, Semoga Keuangan Anda Terkontrol Dengan Baik`;
    }

    // Jalankan fungsi loadData bawaan script.js Anda
    if (typeof loadData === "function") {
        loadData();
    }
});
