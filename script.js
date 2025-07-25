document.addEventListener('DOMContentLoaded', () => {
    // Mendapatkan referensi ke elemen SVG kontainer truk dan tombol "Mulai Tata Letak"
    const truckContainer = document.getElementById('truck-container');
    const startPackingBtn = document.getElementById('start-packing-btn');

    // Mendapatkan dimensi kontainer truk dari atribut SVG
    const containerWidth = parseInt(truckContainer.getAttribute('width'));
    const containerHeight = parseInt(truckContainer.getAttribute('height'));

    // Array untuk menyimpan daftar paket yang akan dimuat. Menggunakan 'let' karena daftar ini akan dimodifikasi.
    let packages = [];
    // ID unik untuk paket berikutnya yang akan ditambahkan
    let nextPackageId = 1;

    // Mendapatkan referensi ke elemen-elemen DOM baru untuk input dan daftar paket
    const addPackageForm = document.getElementById('add-package-form');
    const packageWidthInput = document.getElementById('package-width');
    const packageHeightInput = document.getElementById('package-height');
    const packageValueInput = document.getElementById('package-value');
    const packageTypeInput = document.getElementById('package-type');
    const packageList = document.getElementById('package-list');
    const clearPackagesBtn = document.getElementById('clear-packages-btn');

    // Grid untuk merepresentasikan ruang yang ditempati dalam kontainer.
    // Ini adalah array 2D yang mencerminkan piksel kontainer, di mana 'true' berarti ruang terisi.
    let grid = Array(containerHeight).fill(null).map(() => Array(containerWidth).fill(false));

    /**
     * Menghitung kepadatan nilai (value density) untuk sebuah paket.
     * Kepadatan nilai = nilai paket / (lebar * tinggi)
     * Ini digunakan untuk mengurutkan paket berdasarkan seberapa "berharga" setiap pikselnya.
     * @param {object} pkg - Objek paket dengan properti width, height, dan value.
     * @returns {number} Kepadatan nilai paket.
     */
    function calculateValueDensity(pkg) {
        return pkg.value / (pkg.width * pkg.height);
    }

    /**
     * Mengurutkan array paket berdasarkan kepadatan nilai dari tertinggi ke terendah.
     * Menggunakan spread operator ([...pkgs]) untuk membuat salinan array agar tidak memodifikasi array asli.
     * @param {Array<object>} pkgs - Array objek paket.
     * @returns {Array<object>} Array paket yang sudah diurutkan.
     */
    function sortPackagesByValueDensity(pkgs) {
        return [...pkgs].sort((a, b) => calculateValueDensity(b) - calculateValueDensity(a));
    }

    /**
     * Memeriksa apakah ada ruang kosong yang tersedia untuk menempatkan paket pada koordinat (x, y)
     * dengan lebar dan tinggi tertentu.
     * @param {number} x - Koordinat X awal.
     * @param {number} y - Koordinat Y awal.
     * @param {number} width - Lebar paket.
     * @param {number} height - Tinggi paket.
     * @returns {boolean} True jika ruang tersedia, false jika tidak.
     */
    function isSpaceAvailable(x, y, width, height) {
        // Memeriksa apakah paket keluar dari batas kontainer
        if (x < 0 || y < 0 || x + width > containerWidth || y + height > containerHeight) {
            return false; // Di luar batas
        }
        // Memeriksa setiap piksel dalam area yang akan ditempati paket
        for (let row = y; row < y + height; row++) {
            for (let col = x; col < x + width; col++) {
                // Memeriksa apakah ruang sudah ditempati atau di luar batas grid (pencegahan error)
                if (grid[row] === undefined || grid[row][col] === undefined || grid[row][col]) {
                    return false; // Ruang sudah ditempati atau di luar batas grid
                }
            }
        }
        return true; // Ruang tersedia
    }

    /**
     * Menandai ruang yang ditempati oleh paket di dalam grid.
     * @param {number} x - Koordinat X awal paket.
     * @param {number} y - Koordinat Y awal paket.
     * @param {number} width - Lebar paket.
     * @param {number} height - Tinggi paket.
     */
    function markSpaceOccupied(x, y, width, height) {
        for (let row = y; row < y + height; row++) {
            for (let col = x; col < x + width; col++) {
                grid[row][col] = true; // Menandai piksel sebagai terisi
            }
        }
    }

    /**
     * Menempatkan (menggambar) paket ke dalam kontainer SVG pada koordinat yang ditentukan.
     * @param {object} pkg - Objek paket yang akan ditempatkan.
     * @param {number} x - Koordinat X untuk menempatkan paket.
     * @param {number} y - Koordinat Y untuk menempatkan paket.
     */
    function placePackage(pkg, x, y) {
        const svgNS = "http://www.w3.org/2000/svg"; // Namespace SVG
        const image = document.createElementNS(svgNS, 'image'); // Membuat elemen <image> SVG

        // Mengatur atribut posisi dan ukuran untuk elemen <image>
        image.setAttributeNS(null, 'x', x);
        image.setAttributeNS(null, 'y', y);
        image.setAttributeNS(null, 'width', pkg.width);
        image.setAttributeNS(null, 'height', pkg.height);
        // Menggunakan properti 'image' (tipe) dari paket untuk membentuk path ke aset SVG
        image.setAttributeNS(null, 'href', `assets/${pkg.image}.svg`);

        truckContainer.appendChild(image); // Menambahkan elemen <image> ke dalam SVG kontainer truk
        markSpaceOccupied(x, y, pkg.width, pkg.height); // Menandai ruang di grid sebagai terisi
    }

    /**
     * Mencari posisi kosong pertama yang tersedia di dalam kontainer untuk sebuah paket.
     * Menggunakan algoritma "First Fit" (kiri-ke-kanan, atas-ke-bawah).
     * @param {object} pkg - Objek paket yang akan dicari posisinya.
     * @returns {object|null} Objek {x, y} jika posisi ditemukan, null jika tidak ada ruang.
     */
    function findNextAvailablePosition(pkg) {
        // Iterasi melalui setiap kemungkinan posisi Y
        for (let y = 0; y <= containerHeight - pkg.height; y++) {
            // Iterasi melalui setiap kemungkinan posisi X
            for (let x = 0; x <= containerWidth - pkg.width; x++) {
                // Jika ruang tersedia pada posisi ini, kembalikan koordinatnya
                if (isSpaceAvailable(x, y, pkg.width, pkg.height)) {
                    return { x, y };
                }
            }
        }
        return null; // Tidak ada ruang yang ditemukan
    }

    /**
     * Merender (menampilkan) daftar paket yang saat ini ada di array 'packages' ke dalam sidebar.
     * Setiap paket ditampilkan dengan detail dan tombol "Hapus".
     */
    function renderPackageList() {
        packageList.innerHTML = ''; // Bersihkan daftar yang sudah ada
        packages.forEach(pkg => {
            const listItem = document.createElement('li'); // Buat elemen daftar (li)
            // Mengisi innerHTML dengan detail paket dan tombol hapus
            listItem.innerHTML = `
                ID: ${pkg.id}, L: ${pkg.width}, T: ${pkg.height}, N: ${pkg.value}, Tipe: ${pkg.image}
                <button class="remove-btn" data-id="${pkg.id}">Hapus</button>
            `;
            packageList.appendChild(listItem); // Tambahkan item daftar ke daftar paket (ul)
        });

        // Menambahkan event listener ke setiap tombol "Hapus" yang baru dibuat
        document.querySelectorAll('.remove-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                // Mendapatkan ID paket dari atribut data-id tombol
                const idToRemove = parseInt(event.target.dataset.id);
                // Memfilter array 'packages' untuk menghapus paket dengan ID yang cocok
                packages = packages.filter(pkg => pkg.id !== idToRemove);
                renderPackageList(); // Render ulang daftar paket setelah penghapusan
            });
        });
    }

    // Event listener untuk form "Tambah Paket Baru"
    addPackageForm.addEventListener('submit', (event) => {
        event.preventDefault(); // Mencegah perilaku submit form default (reload halaman)
        // Membuat objek paket baru dari nilai-nilai input form
        const newPackage = {
            id: nextPackageId++, // Menggunakan ID unik dan menambahkannya untuk paket berikutnya
            width: parseInt(packageWidthInput.value), // Mengambil nilai lebar dari input
            height: parseInt(packageHeightInput.value), // Mengambil nilai tinggi dari input
            value: parseInt(packageValueInput.value), // Mengambil nilai nilai dari input
            image: packageTypeInput.value // Mengambil tipe gambar (misal: 'box', 'drum')
        };
        packages.push(newPackage); // Menambahkan paket baru ke array 'packages'
        renderPackageList(); // Merender ulang daftar paket di sidebar
        addPackageForm.reset(); // Mengatur ulang (mengosongkan) form
        // Mengatur ulang nilai default untuk input setelah penambahan
        packageWidthInput.value = 50;
        packageHeightInput.value = 50;
        packageValueInput.value = 10;
        packageTypeInput.value = 'box';
    });

    // Event listener untuk tombol "Bersihkan Daftar Paket"
    clearPackagesBtn.addEventListener('click', () => {
        packages = []; // Mengosongkan array paket
        nextPackageId = 1; // Mengatur ulang ID paket ke 1
        renderPackageList(); // Merender ulang daftar paket (akan kosong)
        truckContainer.innerHTML = ''; // Menghapus semua visualisasi paket dari kontainer truk
    });

    // Event listener untuk tombol "Mulai Tata Letak"
    startPackingBtn.addEventListener('click', () => {
        // Bersihkan visualisasi sebelumnya dari kontainer truk
        truckContainer.innerHTML = '';
        // Mengatur ulang grid (semua ruang menjadi kosong kembali)
        grid = Array(containerHeight).fill(null).map(() => Array(containerWidth).fill(false));

        // Mengurutkan paket berdasarkan kepadatan nilai (strategi greedy)
        const sortedPackages = sortPackagesByValueDensity(packages);

        // Iterasi melalui paket yang sudah diurutkan dan coba menempatkannya
        sortedPackages.forEach(pkg => {
            const position = findNextAvailablePosition(pkg); // Cari posisi yang tersedia
            if (position) {
                placePackage(pkg, position.x, position.y); // Jika ditemukan, tempatkan paket
            }
        });
    });

    // Panggilan awal untuk merender daftar paket saat halaman dimuat (akan kosong pada awalnya)
    renderPackageList();
});