/**
 * Chart.js utilities for SimpleWatch dashboards.
 */

function createResponseTimeChart(canvasId, data) {
    const ctx = document.getElementById(canvasId).getContext('2d');

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Response Time (ms)',
                data: data.values,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        display: false
                    }
                },
                y: {
                    display: true,
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            }
        }
    });
}

function createUptimeChart(canvasId, uptimePercentage) {
    const ctx = document.getElementById(canvasId).getContext('2d');

    const uptime = parseFloat(uptimePercentage);
    const downtime = 100 - uptime;

    return new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Uptime', 'Downtime'],
            datasets: [{
                data: [uptime, downtime],
                backgroundColor: ['#10b981', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.parsed.toFixed(2) + '%';
                        }
                    }
                }
            },
            cutout: '70%'
        }
    });
}

function createAlertCountChart(canvasId, data) {
    const ctx = document.getElementById(canvasId).getContext('2d');

    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Alert Count',
                data: data.values,
                backgroundColor: ['#f59e0b', '#ef4444', '#6b7280'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function updateChartData(chart, newData) {
    chart.data.labels = newData.labels;
    chart.data.datasets[0].data = newData.values;
    chart.update('none');
}

function destroyChart(chart) {
    if (chart) {
        chart.destroy();
    }
}
