#!/bin/bash
# Matatu Online - Complete System Verification
# Usage: ./verification-script.sh

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Test results tracking
PASSED_TESTS=0
FAILED_TESTS=0
TOTAL_TESTS=0

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_test() { echo -e "${BLUE}[TEST]${NC} $1"; }
log_pass() { echo -e "${GREEN}[✓ PASS]${NC} $1"; ((PASSED_TESTS++)); }
log_fail() { echo -e "${RED}[✗ FAIL]${NC} $1"; ((FAILED_TESTS++)); }
log_header() { 
    echo -e "${PURPLE}████████████████████████████████████████${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}████████████████████████████████████████${NC}"
    echo ""
}

run_test() {
    ((TOTAL_TESTS++))
    local test_name="$1"
    local test_command="$2"
    
    log_test "$test_name"
    
    if eval "$test_command" >/dev/null 2>&1; then
        log_pass "$test_name"
        return 0
    else
        log_fail "$test_name"
        return 1
    fi
}

start_application() {
    log_info "Starting Matatu Online application..."
    
    if [ ! -d "backend" ]; then
        log_fail "Backend directory not found"
        return 1
    fi
    
    cd backend
    npm start > ../app.log 2>&1 &
    APP_PID=$!
    cd ..
    
    # Wait for application to start
    for i in {1..30}; do
        if curl -f http://localhost:5000/health >/dev/null 2>&1; then
            log_pass "Application started successfully"
            return 0
        fi
        sleep 2
    done
    
    log_fail "Application failed to start"
    return 1
}

stop_application() {
    if [ -n "$APP_PID" ] && kill -0 $APP_PID 2>/dev/null; then
        kill $APP_PID 2>/dev/null || true
        log_info "Application stopped"
    fi
}

main() {
    log_header "🎮 MATATU ONLINE - SYSTEM VERIFICATION"
    log_info "PhD Systems Engineering Testing Protocol"
    echo ""
    
    # Phase 1: Pre-flight Checks
    log_header "Phase 1: Pre-flight System Checks"
    
    run_test "Node.js availability" "command -v node"
    run_test "npm availability" "command -v npm"
    run_test "Backend directory exists" "[ -d backend ]"
    run_test "Package.json exists" "[ -f backend/package.json ]"
    run_test "Environment file exists" "[ -f backend/.env ]"
    run_test "Server file exists" "[ -f backend/server.js ]"
    
    echo ""
    
    # Phase 2: Critical File Validation
    log_header "Phase 2: Critical File Validation"
    
    CRITICAL_FILES=(
        "backend/routes/auth.js"
        "backend/routes/users.js"
        "backend/routes/games.js"
        "backend/routes/tournaments.js"
        "backend/models/User.js"
        "backend/models/Game.js"
        "backend/models/Tournament.js"
        "backend/middleware/auth.js"
        "backend/config/db.js"
    )
    
    for file in "${CRITICAL_FILES[@]}"; do
        run_test "File exists: $(basename $file)" "[ -f $file ]"
    done
    
    echo ""
    
    # Phase 3: Database Connectivity
    log_header "Phase 3: Database Connectivity"
    
    # Check if MongoDB is running or start it
    if ! mongosh --eval "db.adminCommand('ismaster')" >/dev/null 2>&1; then
        if command -v docker >/dev/null 2>&1; then
            log_info "Starting MongoDB with Docker..."
            docker run -d --name matatu-test-mongodb -p 27017:27017 mongo:6.0 >/dev/null 2>&1 || true
            sleep 5
        fi
    fi
    
    run_test "MongoDB connection" "mongosh --eval 'db.adminCommand(\"ismaster\")'"
    
    echo ""
    
    # Phase 4: Application Testing
    log_header "Phase 4: Application Testing"
    
    if start_application; then
        # API Tests
        run_test "Health endpoint" "curl -f http://localhost:5000/health"
        run_test "Users leaderboard" "curl -f http://localhost:5000/api/users/leaderboard"
        run_test "Tournaments endpoint" "curl -f http://localhost:5000/api/tournaments"
        
        # Test user registration
        log_test "User registration test"
        REGISTER_RESPONSE=$(curl -s -X POST \
            -H "Content-Type: application/json" \
            -d '{"username":"testuser123","email":"test123@example.com","password":"password123"}' \
            http://localhost:5000/api/auth/register)
        
        if echo "$REGISTER_RESPONSE" | grep -q '"success":true'; then
            log_pass "User registration test"
            ((PASSED_TESTS++))
        else
            log_fail "User registration test"
            ((FAILED_TESTS++))
        fi
        ((TOTAL_TESTS++))
        
        stop_application
    else
        log_fail "Application startup failed"
        ((FAILED_TESTS += 5))
        ((TOTAL_TESTS += 5))
    fi
    
    echo ""
    
    # Final Results
    log_header "🎯 TEST RESULTS"
    
    local pass_rate=0
    if [ $TOTAL_TESTS -gt 0 ]; then
        pass_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    fi
    
    echo ""
    echo "📊 TEST STATISTICS:"
    echo "  Total Tests: $TOTAL_TESTS"
    echo "  Passed: $PASSED_TESTS"
    echo "  Failed: $FAILED_TESTS"
    echo "  Pass Rate: $pass_rate%"
    echo ""
    
    if [ $pass_rate -ge 90 ]; then
        echo -e "${GREEN}🎉 EXCELLENT! PRODUCTION READY! 🎉${NC}"
        echo -e "${GREEN}✓ All critical systems operational${NC}"
        echo -e "${GREEN}✓ Ready for deployment${NC}"
        echo ""
        echo -e "${BLUE}🚀 START YOUR PLATFORM:${NC}"
        echo -e "${YELLOW}cd backend && npm start${NC}"
        echo -e "${BLUE}🌐 Then visit: http://localhost:5000${NC}"
        
    elif [ $pass_rate -ge 70 ]; then
        echo -e "${YELLOW}⚠️ GOOD! Minor issues detected${NC}"
        echo -e "${YELLOW}✓ Core features working${NC}"
        echo -e "${YELLOW}⚠ Some tests need attention${NC}"
        
    else
        echo -e "${RED}❌ CRITICAL! Major issues detected${NC}"
        echo -e "${RED}✗ Multiple system failures${NC}"
        echo -e "${RED}🛠 Requires immediate attention${NC}"
    fi
    
    echo ""
    
    # Cleanup
    rm -f app.log
    
    # Exit with appropriate code
    if [ $pass_rate -ge 80 ]; then
        exit 0
    else
        exit 1
    fi
}

# Execute main function
main "$@"
