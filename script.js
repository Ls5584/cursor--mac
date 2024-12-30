// Constants
const DEBOUNCE_DELAY = 300;
const MIN_WORD_LENGTH = 2;
const MAX_CLOUD_WORDS = 100;
const COMMON_CHINESE_STOPWORDS = new Set([
    '的', '了', '和', '是', '就', '都', '而', '及', '与', '着',
    '之', '用', '于', '把', '被', '让', '给', '但', '却', '地',
    '得', '等', '去', '说', '对', '也', '这', '那', '你', '我',
    '他', '她', '它', '们', '么', '什么', '这个', '那个', '哪个',
    '谁', '啊', '呢', '吧', '啦', '吗', '嗯', '哦', '哎', '唉'
]);

// DOM Elements
const elements = {
    themeToggle: document.getElementById('themeToggle'),
    textInput: document.getElementById('textInput'),
    fileInput: document.getElementById('fileInput'),
    analyzeBtn: document.getElementById('analyzeBtn'),
    resetBtn: document.getElementById('resetBtn'),
    frequencyList: document.getElementById('frequencyList'),
    stopwordInput: document.getElementById('stopwordInput'),
    addStopwordBtn: document.getElementById('addStopword'),
    stopwordsList: document.getElementById('stopwordsList'),
    saveImageBtn: document.getElementById('saveImage'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    wordcloud: document.getElementById('wordcloud')
};

// State management
const state = {
    currentText: '',
    stopwords: new Set(COMMON_CHINESE_STOPWORDS),
    isProcessing: false,
    theme: 'light'
};

// Utility functions
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

const showLoading = () => {
    state.isProcessing = true;
    elements.loadingOverlay.hidden = false;
    elements.analyzeBtn.querySelector('.button-text').style.visibility = 'hidden';
    elements.analyzeBtn.querySelector('.loading-spinner').hidden = false;
    elements.analyzeBtn.disabled = true;
};

const hideLoading = () => {
    state.isProcessing = false;
    elements.loadingOverlay.hidden = true;
    elements.analyzeBtn.querySelector('.button-text').style.visibility = 'visible';
    elements.analyzeBtn.querySelector('.loading-spinner').hidden = true;
    elements.analyzeBtn.disabled = false;
};

const showError = (element, message) => {
    element.classList.add('error');
    const notification = document.createElement('div');
    notification.className = 'error-notification';
    notification.textContent = message;
    element.parentNode.appendChild(notification);
    setTimeout(() => {
        element.classList.remove('error');
        notification.remove();
    }, 3000);
};

// Theme management
const toggleTheme = () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    document.body.classList.toggle('dark-theme');
    document.body.classList.toggle('light-theme');
    localStorage.setItem('theme', state.theme);
};

const initTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        state.theme = savedTheme;
        document.body.classList.add(`${savedTheme}-theme`);
    }
};

// File handling
const handleFileInput = async (file) => {
    if (!file) return;
    
    try {
        showLoading();
        const text = await file.text();
        elements.textInput.value = text;
        state.currentText = text;
        elements.textInput.classList.add('success');
        setTimeout(() => elements.textInput.classList.remove('success'), 2000);
    } catch (error) {
        console.error('File reading error:', error);
        showError(elements.fileInput, '文件读取失败，请重试');
    } finally {
        hideLoading();
    }
};

// Text analysis
const tokenize = (text) => {
    // 移除标点符号、特殊字符和数字
    const cleanText = text.replace(/[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~，。！？；：""''（）【】《》、\d]/g, ' ');
    // 分词（使用空格分词，同时处理连续的空格）
    return cleanText.split(/\s+/).filter(word => word.length >= MIN_WORD_LENGTH);
};

const calculateFrequency = (words) => {
    const frequency = {};
    words.forEach(word => {
        if (!state.stopwords.has(word)) {
            frequency[word] = (frequency[word] || 0) + 1;
        }
    });
    return frequency;
};

const updateFrequencyList = (frequency) => {
    const sortedWords = Object.entries(frequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

    const fragment = document.createDocumentFragment();
    sortedWords.forEach(([word, count]) => {
        const div = document.createElement('div');
        div.className = 'frequency-item';
        div.innerHTML = `
            <span>${word}</span>
            <span>${count}</span>
        `;
        fragment.appendChild(div);
    });

    elements.frequencyList.innerHTML = '';
    elements.frequencyList.appendChild(fragment);
};

const generateWordCloud = (frequency) => {
    const words = Object.entries(frequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, MAX_CLOUD_WORDS)
        .map(([text, value]) => ({
            text,
            value: Math.sqrt(value) * 50
        }));

    // 清除现有的词云
    d3.select('#wordcloud').selectAll('*').remove();

    if (words.length === 0) {
        elements.wordcloud.innerHTML = '<div class="empty-state">没有可显示的词云数据</div>';
        return;
    }

    // 设置词云尺寸
    const width = elements.wordcloud.offsetWidth;
    const height = 400;

    // 创建词云布局
    const layout = d3.layout.cloud()
        .size([width, height])
        .words(words)
        .padding(5)
        .rotate(() => 0)
        .font('Arial')
        .fontSize(d => d.value)
        .on('end', draw);

    layout.start();

    function draw(words) {
        const svg = d3.select('#wordcloud')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${width/2},${height/2})`);

        const color = d3.scaleOrdinal(d3.schemeCategory10);

        svg.selectAll('text')
            .data(words)
            .enter()
            .append('text')
            .style('font-size', d => `${d.size}px`)
            .style('font-family', 'Arial')
            .style('fill', (d, i) => color(i))
            .attr('text-anchor', 'middle')
            .attr('transform', d => `translate(${d.x},${d.y})`)
            .text(d => d.text)
            .on('mouseover', function() {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .style('font-size', d => `${d.size * 1.2}px`);
            })
            .on('mouseout', function() {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .style('font-size', d => `${d.size}px`);
            });
    }

    elements.saveImageBtn.disabled = false;
};

// Stopwords management
const addStopword = (word) => {
    if (!word || state.stopwords.has(word)) {
        showError(elements.stopwordInput, '停用词已存在或无效');
        return;
    }

    state.stopwords.add(word);
    const tag = document.createElement('div');
    tag.className = 'stopword-tag';
    tag.innerHTML = `
        ${word}
        <button onclick="removeStopword('${word}')" aria-label="删除停用词 ${word}">×</button>
    `;
    elements.stopwordsList.appendChild(tag);

    // 保存到localStorage
    localStorage.setItem('stopwords', JSON.stringify([...state.stopwords]));

    // 重新分析文本
    if (state.currentText) {
        analyzeText();
    }
};

const removeStopword = (word) => {
    if (COMMON_CHINESE_STOPWORDS.has(word)) {
        showError(elements.stopwordsList, '无法删除内置停用词');
        return;
    }

    state.stopwords.delete(word);
    const tags = elements.stopwordsList.getElementsByClassName('stopword-tag');
    for (const tag of tags) {
        if (tag.textContent.trim().startsWith(word)) {
            tag.remove();
            break;
        }
    }

    // 保存到localStorage
    localStorage.setItem('stopwords', JSON.stringify([...state.stopwords]));

    // 重新分析文本
    if (state.currentText) {
        analyzeText();
    }
};

// Main analysis function
const analyzeText = async () => {
    state.currentText = elements.textInput.value;
    if (!state.currentText.trim()) {
        showError(elements.textInput, '请输入或导入文本');
        return;
    }

    try {
        showLoading();
        await new Promise(resolve => setTimeout(resolve, 100)); // 让UI有时间更新

        const words = tokenize(state.currentText);
        const frequency = calculateFrequency(words);
        
        updateFrequencyList(frequency);
        generateWordCloud(frequency);

    } catch (error) {
        console.error('Analysis error:', error);
        showError(elements.textInput, '文本分析失败，请重试');
    } finally {
        hideLoading();
    }
};

// Save word cloud as image
const saveWordCloud = () => {
    const svg = document.querySelector('#wordcloud svg');
    if (!svg) {
        showError(elements.saveImageBtn, '请先生成词云');
        return;
    }

    try {
        const serializer = new XMLSerializer();
        const svgStr = serializer.serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        canvas.width = svg.width.baseVal.value;
        canvas.height = svg.height.baseVal.value;

        img.onload = () => {
            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--bg-primary');
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            link.download = `词云_${timestamp}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
    } catch (error) {
        console.error('Save image error:', error);
        showError(elements.saveImageBtn, '保存图片失败，请重试');
    }
};

// Reset functionality
const resetAll = () => {
    elements.textInput.value = '';
    state.currentText = '';
    elements.frequencyList.innerHTML = '';
    d3.select('#wordcloud').selectAll('*').remove();
    elements.saveImageBtn.disabled = true;
};

// Initialize
const init = () => {
    initTheme();
    
    // Load saved stopwords
    const savedStopwords = localStorage.getItem('stopwords');
    if (savedStopwords) {
        const customStopwords = JSON.parse(savedStopwords);
        customStopwords.forEach(word => {
            if (!COMMON_CHINESE_STOPWORDS.has(word)) {
                addStopword(word);
            }
        });
    }

    // Event listeners
    elements.themeToggle.addEventListener('click', toggleTheme);
    elements.fileInput.addEventListener('change', e => handleFileInput(e.target.files[0]));
    elements.analyzeBtn.addEventListener('click', analyzeText);
    elements.resetBtn.addEventListener('click', resetAll);
    elements.saveImageBtn.addEventListener('click', saveWordCloud);
    
    elements.addStopwordBtn.addEventListener('click', () => {
        const word = elements.stopwordInput.value.trim();
        if (word) {
            addStopword(word);
            elements.stopwordInput.value = '';
        }
    });

    elements.stopwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const word = elements.stopwordInput.value.trim();
            if (word) {
                addStopword(word);
                elements.stopwordInput.value = '';
            }
        }
    });

    // Auto-save text input
    elements.textInput.addEventListener('input', debounce(() => {
        localStorage.setItem('savedText', elements.textInput.value);
    }, DEBOUNCE_DELAY));

    // Load saved text
    const savedText = localStorage.getItem('savedText');
    if (savedText) {
        elements.textInput.value = savedText;
        state.currentText = savedText;
    }
};

// Start the application
init();