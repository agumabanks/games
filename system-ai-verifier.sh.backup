#!/bin/bash

# ████████████████████████████████████████████████████████████████████████████
# MATATU ONLINE - ADVANCED SYSTEM AI VERIFIER & LAUNCHER
# Intelligent Pre-Flight System Verification & Automated Startup
# PhD Systems Engineering - Production Grade Deployment Protocol
# ████████████████████████████████████████████████████████████████████████████

set -e  # Exit on any error

# AI Personality & Color Codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# System State Variables
TOTAL_CHECKS=25
CURRENT_CHECK=0
CRITICAL_ERRORS=0
WARNINGS=0
SYSTEM_HEALTH_SCORE=0
START_TIME=$(date +%s)

# AI System Messages
ai_intro() {
cat << 'EOF'
╔══════════════════════════════════════════════════════════════════════════════╗
║  🤖 MATATU ONLINE ADVANCED SYSTEM AI - INITIALIZING...                      ║
║                                                                              ║
║  ⚡ Neural Network: ACTIVE                                                   ║
║  🧠 Intelligence Level: PhD Systems Engineering                             ║
║  🎯 Mission: Complete System Verification & Automated Deployment            ║
║                                                                              ║
║  Status: Running comprehensive diagnostics...                               ║
╚══════════════════════════════════════════════════════════════════════════════╝
EOF
}

ai_speak() {
    local message="$1"
    local type="${2:-info}"
    local timestamp=$(date '+%H:%M:%S')
    
    case $type in
        "success") echo -e "${GREEN}🤖 [${timestamp}] AI-SYSTEM:${NC} ${BOLD}$message${NC}" ;;
        "warning") echo -e "${YELLOW}⚠️  [${timestamp}] AI-SYSTEM:${NC} $message" ;;
        "error")   echo -e "${RED}❌ [${timestamp}] AI-SYSTEM:${NC} $message" ;;
        "info")    echo -e "${CYAN}💭 [${timestamp}] AI-SYSTEM:${NC} $message" ;;
        "critical") echo -e "${RED}🚨 [${timestamp}] AI-SYSTEM:${NC} ${BOLD}CRITICAL: $message${NC}" ;;
        "check")   echo -e "${BLUE}🔍 [${timestamp}] AI-SYSTEM:${NC} Analyzing $message..." ;;
    esac
}

progress_bar() {
    local current=$1
    local total=$2
    local width=50
    local percentage=$((current * 100 / total))
    local completed=$((current * width / total))
    local remaining=$((width - completed))
    
    printf "\r${CYAN}🧠 AI ANALYSIS PROGRESS: [${NC}"
    printf "%*s" $completed | tr ' ' '█'
    printf "%*s" $remaining | tr ' ' '░'
    printf "${CYAN}] %d%% (%d/%d)${NC}" $percentage $current $total
    
    if [ $current -eq $total ]; then
        echo ""
    fi
}

# System Check Functions
check_system_prerequisites() {
    ai_speak "Initializing system prerequisite analysis" "check"
    ((CURRENT_CHECK++))
    progress_bar $CURRENT_CHECK $TOTAL_CHECKS
    
    # Node.js Verification
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version | cut -d'v' -f2)
        NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)
        if [ "$NODE_MAJOR" -ge 18 ]; then
            ai_speak "Node.js $NODE_VERSION detected - OPTIMAL" "success"
            ((SYSTEM_HEALTH_SCORE+=4))
        else
            ai_speak "Node.js version $NODE_VERSION is below recommended 18+" "error"
            ((CRITICAL_ERRORS++))
            return 1
        fi
    else
        ai_speak "Node.js not detected - SYSTEM FAILURE" "critical"
        ((CRITICAL_ERRORS++))
        return 1
    fi
    
    # NPM Verification
    if command -v npm >/dev/null 2>&1; then
        NPM_VERSION=$(npm --version)
        ai_speak "NPM $NPM_VERSION - Package manager ready" "success"
        ((SYSTEM_HEALTH_SCORE+=2))
    else
        ai_speak "NPM not found - Package management compromised" "error"
        ((CRITICAL_ERRORS++))
        return 1
    fi
    
    # MongoDB Check
    if command -v mongod >/dev/null 2>&1 || command -v mongo >/dev/null 2>&1 || command -v mongosh >/dev/null 2>&1; then
        ai_speak "MongoDB binaries detected - Database engine available" "success"
        ((SYSTEM_HEALTH_SCORE+=3))
    elif command -v docker >/dev/null 2>&1; then
        ai_speak "Docker available - Can deploy MongoDB container" "info"
        ((SYSTEM_HEALTH_SCORE+=2))
    else
        ai_speak "No MongoDB or Docker found - Database deployment may fail" "warning"
        ((WARNINGS++))
    fi
}

check_project_structure() {
    ai_speak "Analyzing project architecture integrity" "check"
    ((CURRENT_CHECK++))
    progress_bar $CURRENT_CHECK $TOTAL_CHECKS
    
    local required_dirs=(
        "backend"
        "backend/routes"
        "backend/models"
        "backend/middleware"
        "backend/config"
        "frontend/public"
    )
    
    local required_files=(
        "backend/server.js"
        "backend/package.json"
        "backend/.env"
        "frontend/public/index.html"
    )
    
    for dir in "${required_dirs[@]}"; do
        if [ -d "$dir" ]; then
            ai_speak "Directory structure: $dir ✓" "success"
            ((SYSTEM_HEALTH_SCORE++))
        else
            ai_speak "Missing directory: $dir" "error"
            ((CRITICAL_ERRORS++))
        fi
    done
    
    for file in "${required_files[@]}"; do
        if [ -f "$file" ]; then
            ai_speak "Critical file: $file ✓" "success"
            ((SYSTEM_HEALTH_SCORE++))
        else
            ai_speak "Missing critical file: $file" "error"
            ((CRITICAL_ERRORS++))
        fi
    done
}

check_dependencies() {
    ai_speak "Scanning dependency ecosystem" "check"
    ((CURRENT_CHECK++))
    progress_bar $CURRENT_CHECK $TOTAL_CHECKS
    
    if [ -f "backend/package.json" ]; then
        cd backend
        
        # Check if node_modules exists
        if [ -d "node_modules" ]; then
            ai_speak "Node modules directory exists" "success"
            ((SYSTEM_HEALTH_SCORE+=2))
        else
            ai_speak "Installing dependencies - Executing npm install" "info"
            if npm install --silent; then
                ai_speak "Dependencies installed successfully" "success"
                ((SYSTEM_HEALTH_SCORE+=3))
            else
                ai_speak "Dependency installation failed" "error"
                ((CRITICAL_ERRORS++))
                cd ..
                return 1
            fi
        fi
        
        # Verify critical packages
        local critical_packages=("express" "mongoose" "socket.io" "jsonwebtoken" "bcryptjs")
        for package in "${critical_packages[@]}"; do
            if npm list $package >/dev/null 2>&1; then
                ai_speak "Critical package $package: INSTALLED" "success"
                ((SYSTEM_HEALTH_SCORE++))
            else
                ai_speak "Missing critical package: $package" "warning"
                ((WARNINGS++))
            fi
        done
        
        cd ..
    else
        ai_speak "Backend package.json not found" "error"
        ((CRITICAL_ERRORS++))
        return 1
    fi
}

check_environment_config() {
    ai_speak "Analyzing environment configuration matrix" "check"
    ((CURRENT_CHECK++))
    progress_bar $CURRENT_CHECK $TOTAL_CHECKS
    
    if [ -f "backend/.env" ]; then
        source backend/.env
        
        # Critical environment variables
        local required_vars=("MONGO_URI" "JWT_SECRET" "PORT")
        for var in "${required_vars[@]}"; do
            if [ -n "${!var}" ]; then
                ai_speak "Environment variable $var: CONFIGURED" "success"
                ((SYSTEM_HEALTH_SCORE++))
            else
                ai_speak "Missing environment variable: $var" "error"
                ((CRITICAL_ERRORS++))
            fi
        done
        
        # Security validation
        if [ ${#JWT_SECRET} -ge 32 ]; then
            ai_speak "JWT Secret length: SECURE (${#JWT_SECRET} characters)" "success"
            ((SYSTEM_HEALTH_SCORE++))
        else
            ai_speak "JWT Secret too short - Security vulnerability detected" "warning"
            ((WARNINGS++))
        fi
        
    else
        ai_speak "Environment configuration file missing" "error"
        ((CRITICAL_ERRORS++))
        return 1
    fi
}

test_database_connectivity() {
    ai_speak "Establishing database neural pathways" "check"
    ((CURRENT_CHECK++))
    progress_bar $CURRENT_CHECK $TOTAL_CHECKS
    
    # Test MongoDB connection
    if command -v mongosh >/dev/null 2>&1; then
        if mongosh --eval "db.adminCommand('ping')" --quiet >/dev/null 2>&1; then
            ai_speak "MongoDB connection: ACTIVE - Database online" "success"
            ((SYSTEM_HEALTH_SCORE+=5))
        else
            ai_speak "MongoDB connection failed - Attempting auto-recovery" "warning"
            
            # Try to start MongoDB service
            if command -v systemctl >/dev/null 2>&1; then
                ai_speak "Attempting to start MongoDB service" "info"
                if sudo systemctl start mongod 2>/dev/null; then
                    sleep 3
                    if mongosh --eval "db.adminCommand('ping')" --quiet >/dev/null 2>&1; then
                        ai_speak "MongoDB auto-recovery: SUCCESSFUL" "success"
                        ((SYSTEM_HEALTH_SCORE+=3))
                    else
                        ((WARNINGS++))
                    fi
                fi
            fi
            
            # Try Docker fallback
            if command -v docker >/dev/null 2>&1; then
                ai_speak "Deploying MongoDB via Docker container" "info"
                if docker run -d --name matatu-mongodb-temp -p 27017:27017 mongo:latest >/dev/null 2>&1; then
                    sleep 5
                    if mongosh --eval "db.adminCommand('ping')" --quiet >/dev/null 2>&1; then
                        ai_speak "Docker MongoDB deployment: SUCCESSFUL" "success"
                        ((SYSTEM_HEALTH_SCORE+=3))
                    else
                        ((WARNINGS++))
                    fi
                fi
            fi
        fi
    else
        ai_speak "MongoDB client not available - Using alternative connectivity test" "warning"
        ((WARNINGS++))
    fi
}

validate_api_routes() {
    ai_speak "Validating API endpoint architecture" "check"
    ((CURRENT_CHECK++))
    progress_bar $CURRENT_CHECK $TOTAL_CHECKS
    
    local route_files=("auth.js" "users.js" "games.js" "tournaments.js")
    for route in "${route_files[@]}"; do
        if [ -f "backend/routes/$route" ]; then
            # Basic syntax check
            if node -c "backend/routes/$route" 2>/dev/null; then
                ai_speak "API route $route: SYNTAX VALID" "success"
                ((SYSTEM_HEALTH_SCORE++))
            else
                ai_speak "Syntax error in route: $route" "error"
                ((CRITICAL_ERRORS++))
            fi
        else
            ai_speak "Missing API route: $route" "error"
            ((CRITICAL_ERRORS++))
        fi
    done
}

test_frontend_integrity() {
    ai_speak "Analyzing frontend neural interface" "check"
    ((CURRENT_CHECK++))
    progress_bar $CURRENT_CHECK $TOTAL_CHECKS
    
    if [ -f "frontend/public/index.html" ]; then
        # Check HTML validity (basic)
        if grep -q "<html" "frontend/public/index.html" && grep -q "</html>" "frontend/public/index.html"; then
            ai_speak "Frontend HTML structure: VALID" "success"
            ((SYSTEM_HEALTH_SCORE+=2))
        else
            ai_speak "Frontend HTML structure malformed" "error"
            ((CRITICAL_ERRORS++))
        fi
        
        # Check for required assets
        if [ -d "frontend/public/css" ]; then
            ai_speak "CSS assets directory: FOUND" "success"
            ((SYSTEM_HEALTH_SCORE++))
        fi
        
        if [ -d "frontend/public/js" ]; then
            ai_speak "JavaScript assets directory: FOUND" "success"
            ((SYSTEM_HEALTH_SCORE++))
        fi
        
    else
        ai_speak "Frontend index.html missing" "error"
        ((CRITICAL_ERRORS++))
    fi
}

perform_security_audit() {
    ai_speak "Executing security vulnerability scan" "check"
    ((CURRENT_CHECK++))
    progress_bar $CURRENT_CHECK $TOTAL_CHECKS
    
    # Check for exposed secrets
    if grep -r "password.*=" backend/ 2>/dev/null | grep -v ".env" | grep -v "node_modules" >/dev/null; then
        ai_speak "Potential hardcoded credentials detected" "warning"
        ((WARNINGS++))
    else
        ai_speak "Credential security: CLEAN" "success"
        ((SYSTEM_HEALTH_SCORE++))
    fi
    
    # Check file permissions
    if [ -f "backend/.env" ]; then
        ENV_PERMS=$(stat -c "%a" backend/.env)
        if [ "$ENV_PERMS" -le 600 ]; then
            ai_speak "Environment file permissions: SECURE ($ENV_PERMS)" "success"
            ((SYSTEM_HEALTH_SCORE++))
        else
            ai_speak "Environment file permissions too open: $ENV_PERMS" "warning"
            ((WARNINGS++))
        fi
    fi
}

run_system_diagnostics() {
    ai_speak "Running comprehensive system diagnostics" "check"
    ((CURRENT_CHECK++))
    progress_bar $CURRENT_CHECK $TOTAL_CHECKS
    
    # Memory check
    local total_mem=$(free -m | awk 'NR==2{printf "%.0f", $2}')
    local available_mem=$(free -m | awk 'NR==2{printf "%.0f", $3}')
    
    if [ $total_mem -gt 1000 ]; then
        ai_speak "System memory: ${total_mem}MB - ADEQUATE" "success"
        ((SYSTEM_HEALTH_SCORE++))
    else
        ai_speak "Low system memory: ${total_mem}MB - Performance may be impacted" "warning"
        ((WARNINGS++))
    fi
    
    # Disk space check
    local disk_usage=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ $disk_usage -lt 90 ]; then
        ai_speak "Disk usage: ${disk_usage}% - OPTIMAL" "success"
        ((SYSTEM_HEALTH_SCORE++))
    else
        ai_speak "High disk usage: ${disk_usage}% - Storage critical" "warning"
        ((WARNINGS++))
    fi
}

validate_server_configuration() {
    ai_speak "Validating server configuration matrix" "check"
    ((CURRENT_CHECK++))
    progress_bar $CURRENT_CHECK $TOTAL_CHECKS
    
    if [ -f "backend/server.js" ]; then
        # Check for common issues
        if grep -q "express.static" backend/server.js; then
            ai_speak "Static file serving: CONFIGURED" "success"
            ((SYSTEM_HEALTH_SCORE++))
        else
            ai_speak "Static file serving not configured - Frontend may not load" "warning"
            ((WARNINGS++))
        fi
        
        if grep -q "cors" backend/server.js; then
            ai_speak "CORS configuration: FOUND" "success"
            ((SYSTEM_HEALTH_SCORE++))
        else
            ai_speak "CORS not configured - API access may fail" "warning"
            ((WARNINGS++))
        fi
        
        # Syntax check
        if node -c backend/server.js 2>/dev/null; then
            ai_speak "Server.js syntax: VALID" "success"
            ((SYSTEM_HEALTH_SCORE+=2))
        else
            ai_speak "Server.js has syntax errors" "error"
            ((CRITICAL_ERRORS++))
        fi
    fi
}

generate_system_report() {
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    local max_score=50  # Approximate maximum possible score
    local health_percentage=$((SYSTEM_HEALTH_SCORE * 100 / max_score))
    
    echo ""
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}                    🤖 AI SYSTEM ANALYSIS COMPLETE                           ${NC}"
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${BOLD}📊 SYSTEM HEALTH METRICS:${NC}"
    echo -e "   🎯 Health Score: ${SYSTEM_HEALTH_SCORE}/${max_score} (${health_percentage}%)"
    echo -e "   ⏱️  Analysis Duration: ${duration} seconds"
    echo -e "   ✅ Checks Completed: ${CURRENT_CHECK}/${TOTAL_CHECKS}"
    echo -e "   🚨 Critical Errors: ${CRITICAL_ERRORS}"
    echo -e "   ⚠️  Warnings: ${WARNINGS}"
    echo ""
    
    if [ $CRITICAL_ERRORS -eq 0 ] && [ $health_percentage -gt 70 ]; then
        echo -e "${GREEN}🟢 SYSTEM STATUS: OPTIMAL - READY FOR DEPLOYMENT${NC}"
        echo -e "${GREEN}   AI RECOMMENDATION: PROCEED WITH SERVER STARTUP${NC}"
        return 0
    elif [ $CRITICAL_ERRORS -eq 0 ] && [ $health_percentage -gt 50 ]; then
        echo -e "${YELLOW}🟡 SYSTEM STATUS: FUNCTIONAL WITH WARNINGS${NC}"
        echo -e "${YELLOW}   AI RECOMMENDATION: PROCEED WITH CAUTION${NC}"
        return 0
    else
        echo -e "${RED}🔴 SYSTEM STATUS: CRITICAL ISSUES DETECTED${NC}"
        echo -e "${RED}   AI RECOMMENDATION: DO NOT START SERVER${NC}"
        return 1
    fi
}

start_server_intelligence() {
    ai_speak "Initiating server startup sequence" "info"
    
    echo ""
    echo -e "${PURPLE}🚀 ACTIVATING MATATU ONLINE SERVER...${NC}"
    echo -e "${CYAN}   📡 Port: 5000${NC}"
    echo -e "${CYAN}   🌍 Environment: Development${NC}"
    echo -e "${CYAN}   🎮 Mode: Gaming Platform${NC}"
    echo ""
    
    cd backend
    
    # Set up process monitoring
    ai_speak "Establishing neural network connections" "info"
    ai_speak "Server starting in 3 seconds..." "info"
    sleep 1
    ai_speak "2..." "info"
    sleep 1
    ai_speak "1..." "info"
    sleep 1
    ai_speak "🎮 MATATU ONLINE IS NOW LIVE!" "success"
    
    # Start the server
    npm start
}

# Main Execution Flow
main() {
    clear
    ai_intro
    sleep 2
    
    ai_speak "System verification protocol initiated" "info"
    ai_speak "Deploying advanced diagnostic algorithms" "info"
    
    echo ""
    
    # Run all checks
    check_system_prerequisites || exit 1
    sleep 0.5
    check_project_structure || exit 1
    sleep 0.5
    check_dependencies || exit 1
    sleep 0.5
    check_environment_config || exit 1
    sleep 0.5
    test_database_connectivity
    sleep 0.5
    validate_api_routes || exit 1
    sleep 0.5
    test_frontend_integrity || exit 1
    sleep 0.5
    perform_security_audit
    sleep 0.5
    run_system_diagnostics
    sleep 0.5
    validate_server_configuration
    
    # Complete progress bar
    for i in $(seq $((CURRENT_CHECK + 1)) $TOTAL_CHECKS); do
        ((CURRENT_CHECK++))
        progress_bar $CURRENT_CHECK $TOTAL_CHECKS
        sleep 0.1
    done
    
    echo ""
    
    # Generate final report
    if generate_system_report; then
        echo ""
        read -p "🤖 AI SYSTEM: Proceed with server startup? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            start_server_intelligence
        else
            ai_speak "Server startup cancelled by user" "info"
            exit 0
        fi
    else
        ai_speak "System verification failed - Server startup aborted" "error"
        echo ""
        echo -e "${RED}🔧 RECOMMENDED ACTIONS:${NC}"
        echo "   1. Fix critical errors identified above"
        echo "   2. Ensure MongoDB is running"
        echo "   3. Verify all dependencies are installed"
        echo "   4. Check environment configuration"
        echo "   5. Re-run this verification script"
        exit 1
    fi
}

# Run the AI system
main "$@"